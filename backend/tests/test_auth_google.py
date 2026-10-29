"""Sign in with Google (#38). Google is faked: an httpx MockTransport serves the token
endpoint and a signing key generated here, so the real ID-token checks run."""

import json
import time
from datetime import timedelta
from urllib.parse import parse_qs, urlsplit

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy import func, select

from app.google_oidc import ISSUERS, JWKS_URL, TOKEN_URL, GoogleOIDC, get_google
from app.main import app
from app.models import OAuthState, User, UserSession, UserSettings
from app.passwords import hash_password
from app.routers.stock import get_now
from app.sessions import COOKIE
from tests.helpers import NOW

CLIENT_ID = "test-client.apps.googleusercontent.com"
KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class FakeGoogle:
    """Answers Google's token and JWKS endpoints with tokens signed by KEY."""

    def __init__(self):
        self.claims: dict = {}
        self.token_requests: list[dict] = []
        self.key = KEY

    def id_token(self, **overrides) -> str:
        claims = {"iss": ISSUERS[0], "aud": CLIENT_ID, "sub": "google-sub-1",
                  "email": "listener@example.com", "email_verified": True,
                  "iat": int(time.time()), "exp": int(time.time()) + 600, **self.claims,
                  **overrides}
        return jwt.encode(claims, self.key, algorithm="RS256", headers={"kid": "test-key"})

    def handler(self, request: httpx.Request) -> httpx.Response:
        if str(request.url) == TOKEN_URL:
            self.token_requests.append(dict(parse_qs(request.content.decode())))
            return httpx.Response(200, json={"id_token": self.id_token()})
        if str(request.url) == JWKS_URL:
            jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(KEY.public_key()))
            return httpx.Response(200, json={"keys": [{**jwk, "kid": "test-key", "use": "sig",
                                                       "alg": "RS256"}]})
        return httpx.Response(404)


@pytest.fixture
def google(client):
    fake = FakeGoogle()
    http = httpx.Client(transport=httpx.MockTransport(fake.handler))
    app.dependency_overrides[get_google] = lambda: GoogleOIDC(CLIENT_ID, "test-secret", http)
    yield fake
    http.close()


def start(client, return_to="/wishlist"):
    response = client.get("/api/auth/google/start", params={"return_to": return_to},
                          follow_redirects=False)
    assert response.status_code == 302
    query = parse_qs(urlsplit(response.headers["location"]).query)
    return {k: v[0] for k, v in query.items()}


def finish(client, google, params, **claims):
    google.claims = {"nonce": params["nonce"], **claims}
    return client.get("/api/auth/google/callback",
                      params={"code": "auth-code", "state": params["state"]},
                      follow_redirects=False)


def test_providers_reports_google_only_when_configured(client, google):
    assert client.get("/api/auth/providers").json() == {"google": True}
    app.dependency_overrides.pop(get_google)
    assert client.get("/api/auth/providers").json() == {"google": False}
    assert client.get("/api/auth/google/start").status_code == 404


def test_start_uses_pkce_state_and_nonce(client, google):
    params = start(client)
    assert params["code_challenge_method"] == "S256"
    assert params["scope"] == "openid email profile"
    assert params["redirect_uri"] == "http://localhost:5173/api/auth/google/callback"
    assert params["state"] and params["nonce"] and params["code_challenge"]
    assert client.cookies["bh_oauth"] == params["state"]


def test_AC_13_a_new_google_account_starts_private_and_is_signed_in(client, google, session):
    response = finish(client, google, start(client))
    # #43: a brand-new account goes through onboarding first, then on to where it was headed.
    assert (response.status_code, response.headers["location"]) == (302, "/onboarding?return_to=%2Fwishlist")
    user = session.scalar(select(User))
    assert (user.email, user.google_sub, user.auth_provider) == (
        "listener@example.com", "google-sub-1", "google")
    assert user.email_verified_at == NOW and user.password_hash is None
    prefs = session.get(UserSettings, user.id)
    assert {prefs.privacy_profile, prefs.privacy_collection, prefs.privacy_wishlist} == {"private"}
    assert client.get("/api/auth/me").json()["sign_in_methods"] == ["google"]
    # The PKCE verifier went to Google, and the flow can't be replayed.
    assert google.token_requests[0]["code_verifier"]
    assert session.scalar(select(func.count()).select_from(OAuthState)) == 0


def test_signing_in_again_finds_the_same_account(client, google, session):
    finish(client, google, start(client))
    client.cookies.delete(COOKIE)
    finish(client, google, start(client), email="renamed@example.com")
    assert session.scalar(select(func.count()).select_from(User)) == 1


def test_a_verified_email_account_gets_google_linked(client, google, session):
    session.add(User(username="collector-abc123", email="listener@example.com",
                     password_hash=hash_password("their-own-password"), email_verified_at=NOW))
    session.commit()
    finish(client, google, start(client))
    user = session.scalar(select(User))
    assert user.google_sub == "google-sub-1" and user.password_hash is not None
    assert client.get("/api/auth/me").json()["sign_in_methods"] == ["password", "google"]


def test_an_unverified_sign_up_cannot_take_over_the_google_owners_account(client, google, session):
    # Someone signed up with this address without owning it and never confirmed it.
    squatter = User(username="collector-squat1", email="listener@example.com",
                    password_hash=hash_password("squatters-password"))
    session.add(squatter)
    session.flush()
    session.add(UserSession(user_id=squatter.id, token_hash="0" * 64, expires_at=NOW.replace(year=2027)))
    session.commit()
    finish(client, google, start(client))
    session.refresh(squatter)
    assert squatter.password_hash is None and squatter.google_sub == "google-sub-1"
    assert session.scalar(select(UserSession.token_hash)) != "0" * 64  # only the new session


@pytest.mark.parametrize("claims", [
    {"email_verified": False},
    {"aud": "someone-elses-client"},
    {"iss": "https://evil.example.com"},
    {"exp": int(time.time()) - 3600},
    {"nonce": "not-the-nonce"},
])
def test_bad_id_tokens_are_rejected(client, google, session, claims):
    params = start(client)
    google.claims = {"nonce": params["nonce"]}
    google.claims.update(claims)
    response = client.get("/api/auth/google/callback",
                          params={"code": "c", "state": params["state"]}, follow_redirects=False)
    assert response.headers["location"] == "/sign-in?error=google"
    assert session.scalar(select(func.count()).select_from(User)) == 0


def test_a_token_signed_by_another_key_is_rejected(client, google, session):
    params = start(client)
    google.key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    response = finish(client, google, params)
    assert response.headers["location"] == "/sign-in?error=google"


def test_state_must_match_this_browsers_cookie(client, google, session):
    params = start(client)
    client.cookies.delete("bh_oauth")  # e.g. a link someone else started
    response = finish(client, google, params)
    assert response.headers["location"] == "/sign-in?error=google"
    assert COOKIE not in client.cookies


def test_an_expired_flow_fails(client, google):
    params = start(client)
    app.dependency_overrides[get_now] = lambda: NOW + timedelta(minutes=10)
    response = finish(client, google, params)
    assert response.headers["location"] == "/sign-in?error=google"


@pytest.mark.parametrize("return_to", ["https://evil.example.com", "//evil.example.com",
                                       "/\\evil.example.com", "javascript:alert(1)"])
def test_return_to_cannot_leave_the_site(client, google, return_to):
    response = finish(client, google, start(client, return_to))
    assert response.headers["location"] == "/onboarding?return_to=%2Fsearch"


def test_an_existing_account_skips_onboarding(client, google):
    finish(client, google, start(client))
    client.cookies.delete(COOKIE)
    response = finish(client, google, start(client, "/collection"))
    assert response.headers["location"] == "/collection"

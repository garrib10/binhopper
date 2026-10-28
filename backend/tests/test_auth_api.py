"""Email sign-up, sign-in, sessions and password reset (#38)."""

from datetime import timedelta
from types import SimpleNamespace

import pytest
from argon2 import PasswordHasher
from argon2.low_level import Type
from sqlalchemy import func, select

from app import mailer
from app.main import app
from app.passwords import verify_password
from app.models import AuthToken, User, UserSession, UserSettings
from app.routers.stock import get_now
from app.sessions import COOKIE
from tests.helpers import NOW, link_token

EMAIL, PASSWORD = "collector@example.com", "spin-the-b-side"
CSRF = {"X-Binhopper-CSRF": "1"}


@pytest.fixture
def clock(client):
    """A clock tests can move forward."""
    now = SimpleNamespace(value=NOW)
    app.dependency_overrides[get_now] = lambda: now.value
    return now


@pytest.fixture
def api(client):
    client.headers.update(CSRF)  # what the app's fetch helper sends
    return client


def register(api, email=EMAIL, password=PASSWORD):
    response = api.post("/api/auth/register", json={"email": email, "password": password})
    assert response.status_code == 202
    return response


def verified_account(api, email=EMAIL, password=PASSWORD):
    register(api, email, password)
    response = api.post("/api/auth/verify", json={"token": link_token(mailer.outbox[-1])})
    assert response.status_code == 200
    return response


def sign_in(api, email=EMAIL, password=PASSWORD, **kwargs):
    return api.post("/api/auth/sign-in", json={"email": email, "password": password}, **kwargs)


def set_cookies(response) -> list[str]:
    return response.headers.get_list("set-cookie")


# --- Sign-up and verification ----------------------------------------------------------

def test_AC_13_a_new_email_account_starts_private(api, session):
    register(api, " Collector@Example.COM ")
    user = session.scalar(select(User))
    assert user.email == EMAIL and user.username.startswith("collector-")
    assert user.password_hash.startswith("$argon2id$")
    settings = session.get(UserSettings, user.id)
    assert (settings.privacy_profile, settings.privacy_collection, settings.privacy_wishlist) == (
        "private", "private", "private")


def test_AC_19_the_emailed_link_verifies_and_signs_in_once(api, session):
    register(api)
    [message] = mailer.outbox
    assert message["to"] == EMAIL and "/verify#token=" in message["text"]
    token = link_token(message)

    response = api.post("/api/auth/verify", json={"token": token})
    assert response.status_code == 200
    assert response.json()["email_verified"] is True
    assert api.get("/api/auth/me").json()["email"] == EMAIL

    again = api.post("/api/auth/verify", json={"token": token})
    assert again.status_code == 400
    assert again.json()["detail"] == "This link has expired or was already used"


def test_AC_19_a_link_older_than_24_hours_fails(api, clock):
    register(api)
    clock.value = NOW + timedelta(hours=24)
    response = api.post("/api/auth/verify", json={"token": link_token(mailer.outbox[-1])})
    assert response.status_code == 400
    assert sign_in(api).json()["detail"] == "verify_email"


def test_AC_19_a_resent_link_replaces_the_old_one(api):
    register(api)
    first = link_token(mailer.outbox[-1])
    assert api.post("/api/auth/resend-verification", json={"email": EMAIL}).status_code == 202
    second = link_token(mailer.outbox[-1])
    assert api.post("/api/auth/verify", json={"token": first}).status_code == 400
    assert api.post("/api/auth/verify", json={"token": second}).status_code == 200


def test_tokens_are_stored_only_as_hashes(api, session):
    register(api)
    token = link_token(mailer.outbox[-1])
    stored = session.scalar(select(AuthToken))
    assert stored.token_hash != token and len(stored.token_hash) == 64
    api.post("/api/auth/verify", json={"token": token})
    cookie = api.cookies[COOKIE]
    assert session.scalar(select(UserSession)).token_hash not in (cookie, token)


def test_unverified_accounts_cannot_sign_in(api):
    register(api)
    response = sign_in(api)
    assert response.status_code == 403
    assert response.json() == {"detail": "verify_email"}
    assert COOKIE not in api.cookies


@pytest.mark.parametrize("password, message", [
    ("short", "Use at least 10 characters"),
    ("x" * 129, "Use at most 128 characters"),
    (EMAIL, "Your password can't be your email address"),
])
def test_password_rules(api, session, password, message):
    response = api.post("/api/auth/register", json={"email": EMAIL, "password": password})
    assert (response.status_code, response.json()["detail"]) == (422, message)
    assert session.scalar(select(func.count()).select_from(User)) == 0


def test_invalid_email_is_rejected(api):
    response = api.post("/api/auth/register", json={"email": "not-an-email", "password": PASSWORD})
    assert (response.status_code, response.json()["detail"]) == (422, "Enter a valid email address")


# --- Same answers whether or not an account exists -------------------------------------

def test_AC_20_sign_up_answers_the_same_for_a_taken_email(api, session):
    verified_account(api)
    mailer.outbox.clear()
    new = api.post("/api/auth/register", json={"email": "new@example.com", "password": PASSWORD})
    taken = api.post("/api/auth/register", json={"email": EMAIL, "password": "another-password"})
    assert (new.status_code, new.json()) == (taken.status_code, taken.json())
    # The owner hears about it; nobody else learns anything.
    assert [m["subject"] for m in mailer.outbox] == [
        "Confirm your email for Binhopper", "You already have a Binhopper account"]
    assert session.scalar(select(func.count()).select_from(User)) == 2


def test_AC_20_sign_in_answers_the_same_for_unknown_email_and_wrong_password(api, monkeypatch):
    verified_account(api)
    api.cookies.clear()
    checked = []

    def spy(password_hash, password):
        checked.append(password_hash)
        return verify_password(password_hash, password)

    monkeypatch.setattr("app.routers.auth.verify_password", spy)
    unknown = sign_in(api, "nobody@example.com")
    wrong = sign_in(api, EMAIL, "wrong-password-1")
    assert (unknown.status_code, unknown.json()) == (wrong.status_code, wrong.json()) == (
        401, {"detail": "Email or password is incorrect"})
    # The unknown email still ran a hash check, so it takes as long as a wrong password.
    assert checked[0] is None and checked[1] is not None


@pytest.mark.parametrize("path", ["/api/auth/forgot-password", "/api/auth/resend-verification"])
def test_AC_20_email_only_requests_answer_the_same(api, path):
    register(api)
    known = api.post(path, json={"email": EMAIL})
    unknown = api.post(path, json={"email": "nobody@example.com"})
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()


# --- Sessions --------------------------------------------------------------------------

def test_session_cookie_is_httponly_lax_and_secure_behind_https(api):
    register(api)
    token = link_token(mailer.outbox[-1])
    response = api.post("/api/auth/verify", json={"token": token},
                        headers={"X-Forwarded-Proto": "https", "X-Forwarded-For": "203.0.113.9"})
    [cookie] = [c for c in set_cookies(response) if c.startswith(f"{COOKIE}=")]
    attributes = {part.strip().split("=")[0].lower() for part in cookie.split(";")}
    assert {"httponly", "secure", "path", "max-age"} <= attributes
    assert "samesite=lax" in cookie.lower() and "domain" not in attributes
    assert "max-age=2592000" in cookie.lower()  # 30 days
    assert response.headers["cache-control"] == "no-store"


def test_cookie_is_not_secure_on_plain_http_for_local_dev(api):
    response = verified_account(api)
    [cookie] = [c for c in set_cookies(response) if c.startswith(f"{COOKIE}=")]
    assert "secure" not in cookie.lower()


def test_signing_in_rotates_the_session(api, session):
    verified_account(api)
    first = api.cookies[COOKIE]
    assert sign_in(api).status_code == 200
    assert api.cookies[COOKIE] != first
    assert session.scalar(select(func.count()).select_from(UserSession)) == 1


def test_sign_out_ends_the_session(api, session):
    verified_account(api)
    response = api.post("/api/auth/sign-out")
    assert response.status_code == 204
    assert any(c.startswith(f'{COOKIE}=""') or "max-age=0" in c.lower()
               for c in set_cookies(response))
    assert session.scalar(select(func.count()).select_from(UserSession)) == 0
    assert api.get("/api/auth/me").status_code == 401


def test_me_is_401_when_signed_out(api):
    response = api.get("/api/auth/me")
    assert response.status_code == 401


def test_sessions_last_30_days_and_slide_when_used(api, clock):
    verified_account(api)
    clock.value = NOW + timedelta(days=16)  # under 15 days left: renewed
    response = api.get("/api/auth/me")
    assert response.status_code == 200
    assert any(c.startswith(f"{COOKIE}=") for c in set_cookies(response))
    clock.value = NOW + timedelta(days=45)  # 29 days after the renewal
    assert api.get("/api/auth/me").status_code == 200
    clock.value = NOW + timedelta(days=77)
    assert api.get("/api/auth/me").status_code == 401


def test_password_is_argon2id_and_rehashed_when_parameters_change(api, session):
    assert PasswordHasher().type is Type.ID  # the production defaults
    verified_account(api)
    user = session.scalar(select(User))
    user.password_hash = PasswordHasher(time_cost=2, memory_cost=8, parallelism=1).hash(PASSWORD)
    session.commit()
    old = user.password_hash
    assert sign_in(api).status_code == 200
    session.refresh(user)
    assert user.password_hash != old and user.password_hash.startswith("$argon2id$")


# --- Password reset --------------------------------------------------------------------

def test_AC_21_reset_ends_every_session_and_signs_in_fresh(api, client, session):
    verified_account(api)
    other_browser = api.cookies[COOKIE]
    mailer.outbox.clear()
    api.post("/api/auth/forgot-password", json={"email": EMAIL})
    [message] = mailer.outbox
    assert "/reset-password#token=" in message["text"]
    token = link_token(message)

    response = api.post("/api/auth/reset-password",
                        json={"token": token, "password": "a-brand-new-pass"})
    assert response.status_code == 200
    assert api.cookies[COOKIE] != other_browser
    api.cookies.set(COOKIE, other_browser)
    assert api.get("/api/auth/me").status_code == 401  # the old session is gone
    api.cookies.clear()
    assert sign_in(api).status_code == 401
    assert sign_in(api, password="a-brand-new-pass").status_code == 200
    again = api.post("/api/auth/reset-password", json={"token": token, "password": "yet-another-1"})
    assert again.status_code == 400


def test_AC_21_reset_link_expires_after_an_hour(api, clock):
    verified_account(api)
    api.post("/api/auth/forgot-password", json={"email": EMAIL})
    clock.value = NOW + timedelta(hours=1)
    response = api.post("/api/auth/reset-password",
                        json={"token": link_token(mailer.outbox[-1]), "password": "a-brand-new-pass"})
    assert response.status_code == 400


def test_a_weak_new_password_keeps_the_reset_link_usable(api):
    verified_account(api)
    api.post("/api/auth/forgot-password", json={"email": EMAIL})
    token = link_token(mailer.outbox[-1])
    weak = api.post("/api/auth/reset-password", json={"token": token, "password": "short"})
    assert weak.status_code == 422
    ok = api.post("/api/auth/reset-password", json={"token": token, "password": "long-enough-now"})
    assert ok.status_code == 200


def test_resetting_confirms_an_unverified_email(api):
    register(api)
    api.post("/api/auth/forgot-password", json={"email": EMAIL})
    response = api.post("/api/auth/reset-password",
                        json={"token": link_token(mailer.outbox[-1]), "password": "long-enough-now"})
    assert response.json()["email_verified"] is True


def test_google_only_accounts_are_told_to_use_google(api, session):
    user = User(username="collector-goog01", email=EMAIL, auth_provider="google",
                google_sub="g-1", email_verified_at=NOW)
    session.add(user)
    session.commit()
    assert api.post("/api/auth/forgot-password", json={"email": EMAIL}).status_code == 202
    assert [m["subject"] for m in mailer.outbox] == ["You sign in to Binhopper with Google"]

"""Google sign-in: OpenID Connect authorization code flow with PKCE, state and nonce.

The backend does the whole exchange, so the client secret never leaves the server.
Tests pass an httpx MockTransport; no test calls Google.
"""

import base64
import hashlib
import hmac
from collections.abc import Iterator
from urllib.parse import urlencode

import httpx
import jwt

from app.config import settings

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
ISSUERS = ["https://accounts.google.com", "accounts.google.com"]


class GoogleSignInError(Exception):
    pass


def code_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


class GoogleOIDC:
    def __init__(self, client_id: str, client_secret: str, http: httpx.Client) -> None:
        self.client_id, self.client_secret, self.http = client_id, client_secret, http

    def authorization_url(self, redirect_uri: str, state: str, nonce: str, verifier: str) -> str:
        return AUTH_URL + "?" + urlencode({
            "client_id": self.client_id, "redirect_uri": redirect_uri, "response_type": "code",
            "scope": "openid email profile", "state": state, "nonce": nonce,
            "code_challenge": code_challenge(verifier), "code_challenge_method": "S256",
            "prompt": "select_account",
        })

    def claims(self, code: str, verifier: str, redirect_uri: str, nonce: str) -> dict:
        """Exchange the code and return the ID token's verified claims."""
        try:
            response = self.http.post(TOKEN_URL, data={
                "code": code, "client_id": self.client_id, "client_secret": self.client_secret,
                "redirect_uri": redirect_uri, "grant_type": "authorization_code",
                "code_verifier": verifier,
            })
            response.raise_for_status()
            id_token = response.json()["id_token"]
            keys = jwt.PyJWKSet.from_dict(self.http.get(JWKS_URL).raise_for_status().json())
            kid = jwt.get_unverified_header(id_token).get("kid")
            key = next((k for k in keys.keys if k.key_id == kid), None)
            if key is None:
                raise GoogleSignInError("unknown signing key")
            claims = jwt.decode(id_token, key=key.key, algorithms=["RS256"],
                                audience=self.client_id, issuer=ISSUERS, leeway=60,
                                options={"require": ["exp", "iat", "iss", "aud", "sub"]})
        except (httpx.HTTPError, KeyError, ValueError, jwt.PyJWTError) as exc:
            raise GoogleSignInError(str(exc)) from exc
        if not hmac.compare_digest(str(claims.get("nonce", "")), nonce):
            raise GoogleSignInError("nonce mismatch")
        if claims.get("email_verified") is not True or not claims.get("email"):
            raise GoogleSignInError("email not verified by Google")
        return claims


def get_google() -> Iterator[GoogleOIDC | None]:
    """Dependency: the Google client, or None when sign-in with Google isn't configured."""
    if not (settings.google_client_id and settings.google_client_secret):
        yield None
        return
    with httpx.Client(timeout=10) as http:
        yield GoogleOIDC(settings.google_client_id, settings.google_client_secret, http)

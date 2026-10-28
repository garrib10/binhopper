"""Discogs OAuth 1.0a (PLAINTEXT signatures over HTTPS, as Discogs documents) (#44).

The API makes only these three handshake calls; everything else (collection and
wantlist pages, catalog lookups) goes through the worker. All of them reserve a slot
in the shared 60-per-minute Discogs quota first.
"""

import secrets
import time
from urllib.parse import parse_qs, quote

from app.config import settings
from app.discogs import RequestQueue

AUTHORIZE_URL = "https://discogs.com/oauth/authorize"


class DiscogsOAuthError(Exception):
    pass


def configured() -> bool:
    return bool(settings.discogs_consumer_key and settings.discogs_consumer_secret
                and settings.token_encryption_key)


def header(token: str | None = None, token_secret: str = "", **extra: str) -> str:
    """The OAuth Authorization header for one request."""
    fields = {
        "oauth_consumer_key": settings.discogs_consumer_key,
        "oauth_nonce": secrets.token_hex(16),
        "oauth_signature": f"{settings.discogs_consumer_secret}&{token_secret}",
        "oauth_signature_method": "PLAINTEXT",
        "oauth_timestamp": str(int(time.time())),
        **({"oauth_token": token} if token else {}),
        **extra,
    }
    return "OAuth " + ", ".join(f'{k}="{quote(v, safe="")}"' for k, v in fields.items())


def _form(queue: RequestQueue, path: str, auth: str) -> dict[str, str]:
    queue.reserve()
    response = queue.client.post(path, headers={"Authorization": auth,
                                                 "Content-Type": "application/x-www-form-urlencoded"})
    if response.status_code != 200:
        raise DiscogsOAuthError(f"{path} answered {response.status_code}")
    return {k: v[0] for k, v in parse_qs(response.text).items()}


def request_token(queue: RequestQueue, callback: str) -> tuple[str, str]:
    body = _form(queue, "/oauth/request_token", header(oauth_callback=callback))
    if "oauth_token" not in body or "oauth_token_secret" not in body:
        raise DiscogsOAuthError("no request token")
    return body["oauth_token"], body["oauth_token_secret"]


def access_token(queue: RequestQueue, token: str, secret: str, verifier: str) -> tuple[str, str]:
    body = _form(queue, "/oauth/access_token", header(token, secret, oauth_verifier=verifier))
    if "oauth_token" not in body or "oauth_token_secret" not in body:
        raise DiscogsOAuthError("no access token")
    return body["oauth_token"], body["oauth_token_secret"]


def identity(queue: RequestQueue, token: str, secret: str) -> str:
    """The connected user's Discogs username."""
    payload = queue.request("/oauth/identity", headers={"Authorization": header(token, secret)})
    username = payload.get("username")
    if not username:
        raise DiscogsOAuthError("no username")
    return username

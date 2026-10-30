"""Reject /api requests that didn't come through the Vercel /api proxy (#122).

Vercel's proxy (frontend/proxy.ts) adds `X-Origin-Secret`; anyone calling the Railway
URL directly can't, so they can't spoof X-Forwarded-For past rate limits either.
`/api/health` stays open for Railway's health check and the deploy check (it only
reveals status and commit), and `/api/health/db` for uptime monitors (status only). With no secret configured (local dev, tests) nothing is
checked.
"""

import hmac

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.config import settings

HEADER = b"x-origin-secret"
EXEMPT = {"/api/health", "/api/health/db"}


def configured_secrets() -> list[bytes]:
    # Comma-separated so a rotation can accept "new,old" for a while.
    return [s.strip().encode() for s in settings.origin_secret.split(",") if s.strip()]


class OriginSecretMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        secrets = configured_secrets()
        path = scope.get("path", "")
        if (scope["type"] != "http" or not secrets or not path.startswith("/api/")
                or path in EXEMPT):
            await self.app(scope, receive, send)
            return
        sent = next((value for name, value in scope["headers"] if name == HEADER), b"")
        # Compare against every accepted secret so timing doesn't reveal which matched.
        matches = [hmac.compare_digest(sent, secret) for secret in secrets]
        if any(matches):
            await self.app(scope, receive, send)
            return
        await JSONResponse({"detail": "Forbidden"}, status_code=403)(scope, receive, send)

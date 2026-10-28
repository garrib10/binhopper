"""Block cross-site requests that change things (POST/PUT/PATCH/DELETE under /api).

SameSite=Lax already keeps the session cookie off cross-site POSTs. On top of that,
the app's fetch helper sends `X-Binhopper-CSRF: 1`: a cross-site page can't add a
custom header without a CORS preflight, which only the app's own origins pass. And
when the browser sends an Origin header, it must be the app's.
"""

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.config import settings

HEADER = b"x-binhopper-csrf"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def allowed_origins() -> set[bytes]:
    return {o.rstrip("/").encode() for o in [settings.public_app_url, *settings.cors_origins]}


class CSRFMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (scope["type"] != "http" or scope["method"] in SAFE_METHODS
                or not scope.get("path", "").startswith("/api/")):
            await self.app(scope, receive, send)
            return
        headers = dict(scope["headers"])
        origin = headers.get(b"origin")
        if headers.get(HEADER) == b"1" and (origin is None or origin in allowed_origins()):
            await self.app(scope, receive, send)
            return
        await JSONResponse({"detail": "Forbidden"}, status_code=403)(scope, receive, send)

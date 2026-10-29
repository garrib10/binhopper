import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.config import settings
from app.csrf import CSRFMiddleware
from app.origin_secret import OriginSecretMiddleware
from app.routers import stock
from app.routers.auth import router as auth_router
from app.routers.wishlist import router as wishlist_router
from app.routers.collection import router as collection_router
from app.routers.reports import router as reports_router
from app.routers.me import router as me_router
from app.routers.zips import router as zips_router
from app.routers.handoff import router as handoff_router
from app.routers.discogs_import import router as discogs_import_router
from app.routers.search import router as search_router
from app.routers.albums import router as albums_router
from app.routers.artists import router as artists_router

app = FastAPI(
    title="Binhopper API",
    version="0.1.0",
    description="Catalog, nearby stock, wishlist and collection. Try endpoints at /docs.",
)



# Defined before the add_middleware calls below, so it runs innermost.
@app.middleware("http")
async def no_store_for_auth(request, call_next):
    """Sign-in responses carry cookies and account data: never cache them."""
    response = await call_next(request)
    if request.url.path.startswith("/api/auth/"):
        response.headers["Cache-Control"] = "no-store"
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
# POST/PUT/PATCH/DELETE need the app's X-Binhopper-CSRF header and origin (#38).
app.add_middleware(CSRFMiddleware)
# Direct calls to the Railway URL (not through Vercel's proxy) get 403 on /api (#122).
app.add_middleware(OriginSecretMiddleware)
# Requests arrive via Vercel's /api proxy and Railway's edge: take the visitor's IP
# and https scheme from X-Forwarded-For / X-Forwarded-Proto (for rate limits and
# secure cookies). Added last, so it runs before every other middleware.
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=settings.forwarded_allow_ips)

app.include_router(auth_router)
app.include_router(wishlist_router)
app.include_router(collection_router)
app.include_router(reports_router)
app.include_router(me_router)
app.include_router(zips_router)
app.include_router(handoff_router)
app.include_router(discogs_import_router)
app.include_router(stock.router)
app.include_router(search_router)
app.include_router(albums_router)
app.include_router(artists_router)


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "commit": os.getenv("RAILWAY_GIT_COMMIT_SHA", "local")}

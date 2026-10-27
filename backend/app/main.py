import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.config import settings
from app.origin_secret import OriginSecretMiddleware
from app.routers import stock
from app.routers.search import router as search_router
from app.routers.albums import router as albums_router
from app.routers.artists import router as artists_router

app = FastAPI(
    title="Binhopper API",
    version="0.1.0",
    description="Catalog, nearby stock, wishlist and collection. Try endpoints at /docs.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Direct calls to the Railway URL (not through Vercel's proxy) get 403 on /api (#122).
app.add_middleware(OriginSecretMiddleware)
# Requests arrive via Vercel's /api proxy and Railway's edge: take the visitor's IP
# and https scheme from X-Forwarded-For / X-Forwarded-Proto (for rate limits and
# secure cookies). Added last, so it runs before every other middleware.
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=settings.forwarded_allow_ips)

app.include_router(stock.router)
app.include_router(search_router)
app.include_router(albums_router)
app.include_router(artists_router)


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "commit": os.getenv("RAILWAY_GIT_COMMIT_SHA", "local")}

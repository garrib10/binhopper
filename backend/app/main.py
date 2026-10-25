import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import stock
from app.routers.search import router as search_router

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

app.include_router(stock.router)
app.include_router(search_router)


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "commit": os.getenv("RAILWAY_GIT_COMMIT_SHA", "local")}

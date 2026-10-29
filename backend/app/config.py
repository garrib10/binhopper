from typing import Literal

from pydantic import Field, HttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables or backend/.env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "mysql+pymysql://binhopper:binhopper@127.0.0.1:3306/binhopper"
    discogs_token: str = ""
    discogs_user_agent: str = "Binhopper/0.1 (catalog-gap-worker; github.com/garrib10/binhopper)"
    # Only local dev needs CORS: deployed, the app calls /api on its own origin via Vercel.
    cors_origins: list[str] = ["http://localhost:5173"]
    # Peers allowed to set X-Forwarded-For/-Proto (uvicorn syntax: "*" or comma-separated
    # IPs/CIDRs). Railway's edge connects from changing private IPs, hence "*".
    forwarded_allow_ips: str = "*"
    # Shared with Vercel's /api proxy, which sends it as X-Origin-Secret (#122). Empty =
    # no check (local dev). Comma-separated to accept "new,old" during a rotation.
    origin_secret: str = ""
    # The app's public address (no trailing slash): links in emails, Google's redirect URI
    # and the allowed Origin for POSTs. Staging: the Vercel staging URL.
    public_app_url: str = "http://localhost:5173"
    # Where sign-in emails go: log (print them, local dev), file (JSON in email_file_dir,
    # local system tests), memory (pytest) or resend (staging/production).
    email_backend: Literal["log", "file", "memory", "resend"] = "log"
    email_from: str = "Binhopper <onboarding@resend.dev>"
    email_file_dir: str = "outbox"
    resend_api_key: str = ""
    # Google sign-in shows only when both are set (Google Cloud › Credentials).
    google_client_id: str = ""
    google_client_secret: str = ""
    # Discogs import (#44): the app registered at discogs.com/settings/developers, and the
    # Fernet key that encrypts users' Discogs tokens at rest (generate it, never commit it).
    discogs_consumer_key: str = ""
    discogs_consumer_secret: str = ""
    token_encryption_key: str = ""
    # Manually verified artist-ID → official shop URL; never guessed from a name.
    artist_store_urls: dict[int, HttpUrl] = Field(default_factory=dict)

    @field_validator("database_url", mode="before")
    @classmethod
    def railway_mysql_url(cls, value: str) -> str:
        if value.startswith("mysql://"):
            return "mysql+pymysql://" + value[len("mysql://"):]
        return value

    @field_validator("public_app_url")
    @classmethod
    def no_trailing_slash(cls, value: str) -> str:
        return value.rstrip("/")


settings = Settings()

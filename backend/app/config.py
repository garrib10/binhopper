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
    # Manually verified artist-ID → official shop URL; never guessed from a name.
    artist_store_urls: dict[int, HttpUrl] = Field(default_factory=dict)

    @field_validator("database_url", mode="before")
    @classmethod
    def railway_mysql_url(cls, value: str) -> str:
        if value.startswith("mysql://"):
            return "mysql+pymysql://" + value[len("mysql://"):]
        return value


settings = Settings()

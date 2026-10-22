from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables or backend/.env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "mysql+pymysql://binhopper:binhopper@127.0.0.1:3306/binhopper"
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()

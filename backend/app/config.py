from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables or backend/.env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "mysql+pymysql://binhopper:binhopper@127.0.0.1:3306/binhopper"
    cors_origins: list[str] = ["http://localhost:5173"]

    @field_validator("database_url", mode="before")
    @classmethod
    def railway_mysql_url(cls, value: str) -> str:
        if value.startswith("mysql://"):
            return "mysql+pymysql://" + value[len("mysql://"):]
        return value


settings = Settings()

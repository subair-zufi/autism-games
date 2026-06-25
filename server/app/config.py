"""Application configuration loaded from environment variables / .env file."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/autism_games"

    # Security
    secret_key: str = "CHANGE_ME_IN_PRODUCTION_use_a_long_random_string"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days for players
    admin_token_expire_minutes: int = 60 * 8  # 8 hours for admins

    # First admin seeded on startup (used by seed script / startup hook)
    admin_email: str = "admin@autism-games.com"
    admin_password: str = "admin123"

    # CORS — comma separated list of allowed origins for the game frontend
    cors_origins: str = "http://localhost:5173,http://localhost:4173,http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

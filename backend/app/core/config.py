from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "Smart Milling AI Platform API"
    env: str = "dev"
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "smart_milling"
    api_prefix: str = "/api/v1"
    auth_secret_key: str = "twinsmill-dev-secret-change-me"
    auth_access_token_exp_minutes: int = 480
    auth_issuer: str = "twinsmill-api"
    auth_audience: str = "twinsmill-web"
    frontend_origins: str = "http://localhost:3010"
    auth_cookie_name: str = "twinsmill_auth"
    auth_refresh_cookie_name: str = "twinsmill_refresh"
    auth_cookie_secure: bool = False
    auth_cookie_samesite: str = "lax"
    auth_refresh_token_exp_days: int = 14
    auth_lockout_max_attempts: int = 5
    auth_lockout_minutes: int = 15
    auth_access_token_sliding_minutes: int = 15
    platform_admin_email: str = "admin@twinsmill.local"
    enable_synthetic_seed: bool = False

    @property
    def frontend_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_DIR / ".env.example"), str(BACKEND_DIR / ".env")),
        extra="ignore",
    )


settings = Settings()

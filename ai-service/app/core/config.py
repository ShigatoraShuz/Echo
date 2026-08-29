from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"
    host: str = "0.0.0.0"
    port: int = Field(default=8000, ge=1, le=65535)
    analysis_service_token: str = ""
    user_service_token: str = ""
    journal_service_token: str = ""
    ml_service_token: str = ""
    recommendation_service_token: str = ""
    supabase_url: str = ""
    supabase_database_key: str = ""
    user_service_url: str = ""
    journal_service_url: str = ""
    ml_service_url: str = ""
    recommendation_service_url: str = ""
    request_timeout_seconds: float = Field(default=10, ge=0.1, le=120)
    log_level: str = "INFO"
    rate_limit_per_minute: int = Field(default=60, ge=1, le=10_000)
    rate_limit_window_seconds: int = Field(default=60, ge=1, le=3_600)

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        tokens = {
            "ANALYSIS_SERVICE_TOKEN": self.analysis_service_token,
            "USER_SERVICE_TOKEN": self.user_service_token,
            "JOURNAL_SERVICE_TOKEN": self.journal_service_token,
            "ML_SERVICE_TOKEN": self.ml_service_token,
            "RECOMMENDATION_SERVICE_TOKEN": self.recommendation_service_token,
        }
        if self.app_env == "production":
            invalid = [name for name, value in tokens.items() if len(value) < 32]
            if invalid:
                raise ValueError(
                    f"Service tokens must contain at least 32 characters: {', '.join(invalid)}"
                )
            required = {
                "SUPABASE_URL": self.supabase_url,
                "SUPABASE_DATABASE_KEY": self.supabase_database_key,
                "USER_SERVICE_URL": self.user_service_url,
                "JOURNAL_SERVICE_URL": self.journal_service_url,
                "ML_SERVICE_URL": self.ml_service_url,
                "RECOMMENDATION_SERVICE_URL": self.recommendation_service_url,
            }
            missing = [name for name, value in required.items() if not value.strip()]
            if missing:
                raise ValueError(
                    f"Production analysis configuration is missing: {', '.join(missing)}"
                )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()

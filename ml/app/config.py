from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_env: Literal["development", "test", "production"] = "development"
    host: str = "0.0.0.0"
    port: int = Field(default=8001, ge=1, le=65535)
    ml_service_token: str = ""
    base_model_id: str = "microsoft/Phi-4-mini-instruct"
    lora_adapter_path: str = "/models/echo-adapter"
    model_version: str = "phi4-mini-echo-v1"
    device: str = "cuda"

    @model_validator(mode="after")
    def production_token(self) -> "Settings":
        if self.app_env == "production" and len(self.ml_service_token) < 32:
            raise ValueError("ML_SERVICE_TOKEN must contain at least 32 characters.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()

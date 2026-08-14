from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"
    host: str = "0.0.0.0"
    port: int = Field(default=8000, ge=1, le=65535)
    ai_service_token: str = ""
    base_model_id: str = "microsoft/Phi-4-mini-instruct"
    lora_adapter_path: str = "/models/echo-adapter"
    model_version: str = "phi4-mini-echo-v1"
    max_input_tokens: int = Field(default=384, ge=32, le=4096)
    max_new_tokens: int = Field(default=64, ge=1, le=512)
    device: str = "cuda"
    torch_dtype: str = "bfloat16"
    log_level: str = "INFO"

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.app_env == "production" and len(self.ai_service_token) < 32:
            raise ValueError("AI_SERVICE_TOKEN must contain at least 32 characters in production.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()

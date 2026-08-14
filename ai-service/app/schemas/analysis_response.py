from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class AnalysisResponse(BaseModel):
    request_id: UUID
    phq8_score: int = Field(ge=0, le=24)
    severity: Literal["minimal", "mild", "moderate", "moderately_severe", "severe"]
    urgent_language_detected: bool
    model_version: str = Field(min_length=1, max_length=128)
    processing_time_ms: int = Field(ge=0)

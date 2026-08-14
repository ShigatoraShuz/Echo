from uuid import UUID

from pydantic import BaseModel, Field


class AnalysisRequest(BaseModel):
    request_id: UUID
    journal_text: str = Field(min_length=1, max_length=20_000)
    language: str = Field(default="en", min_length=2, max_length=16)

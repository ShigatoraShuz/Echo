from pydantic import BaseModel


class ReadinessResponse(BaseModel):
    status: str
    model_loaded: bool
    device: str

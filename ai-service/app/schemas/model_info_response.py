from pydantic import BaseModel


class ModelInfoResponse(BaseModel):
    model_name: str
    adapter_version: str
    model_version: str
    device: str
    max_input_tokens: int
    ready: bool

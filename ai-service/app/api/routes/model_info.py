from fastapi import APIRouter, Depends, Request

from app.core.security import require_internal_token
from app.schemas.model_info_response import ModelInfoResponse

router = APIRouter(dependencies=[Depends(require_internal_token)])


@router.get("/v1/model", response_model=ModelInfoResponse)
def model_info(request: Request) -> ModelInfoResponse:
    runtime = request.app.state.model_runtime
    return ModelInfoResponse(
        model_name=runtime.model_name,
        adapter_version=runtime.adapter_path,
        model_version=runtime.model_version,
        device=runtime.device,
        max_input_tokens=runtime.max_input_tokens,
        ready=runtime.loaded,
    )

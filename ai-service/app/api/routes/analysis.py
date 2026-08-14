from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.exceptions import ModelUnavailableError
from app.core.security import require_internal_token
from app.schemas.analysis_request import AnalysisRequest
from app.schemas.analysis_response import AnalysisResponse

router = APIRouter(dependencies=[Depends(require_internal_token)])


@router.post("/v1/analyze", response_model=AnalysisResponse)
def analyze(payload: AnalysisRequest, request: Request) -> AnalysisResponse:
    del payload
    runtime = request.app.state.model_runtime
    try:
        runtime.require_ready()
    except ModelUnavailableError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The analysis service is not ready.",
        ) from error

    # Intentionally unreachable until a validated, deterministic runtime is wired.
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Validated inference is not configured.",
    )

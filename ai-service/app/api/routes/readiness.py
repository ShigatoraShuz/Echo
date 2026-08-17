from fastapi import APIRouter, Request, Response, status

from app.schemas.readiness_response import ReadinessResponse

router = APIRouter()


@router.get("/ready", response_model=ReadinessResponse)
def readiness(request: Request, response: Response) -> ReadinessResponse:
    runtime = request.app.state.model_runtime
    if not runtime.loaded:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return ReadinessResponse(status="not_ready", model_loaded=False)
    return ReadinessResponse(status="ready", model_loaded=True)
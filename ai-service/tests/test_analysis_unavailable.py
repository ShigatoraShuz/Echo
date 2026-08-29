import asyncio

import httpx
import pytest
from fastapi import HTTPException

from app.api.routes.analysis import checked_json


def test_ml_readiness_failure_becomes_a_controlled_product_error() -> None:
    response = httpx.Response(503, json={"detail": "Validated model inference is unavailable."})
    with pytest.raises(HTTPException) as captured:
        asyncio.run(checked_json(response, "ml-service"))
    assert captured.value.status_code == 503
    assert captured.value.detail == "Validated model currently unavailable."

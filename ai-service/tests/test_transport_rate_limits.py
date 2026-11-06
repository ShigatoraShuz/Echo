import asyncio
from types import SimpleNamespace
from starlette.requests import Request
from starlette.responses import Response
from app.api import middleware


def request(path,token='correct'):
 return Request({'type':'http','method':'GET','path':path,'headers':[(b'authorization',('Bearer '+token).encode())], 'client':('127.0.0.1',1234),'query_string':b''})


def configure(monkeypatch):
 monkeypatch.setattr('app.core.security.get_settings',lambda:SimpleNamespace(ai_service_token='correct'))
 monkeypatch.setattr(middleware,'get_settings',lambda:SimpleNamespace(rate_limit_window_seconds=60))
 monkeypatch.setattr(middleware,'_limiter',middleware.create_rate_limiter(2))
 monkeypatch.setattr(middleware,'_status_limiter',middleware.create_rate_limiter(3))
 monkeypatch.setattr(middleware,'_inference_limiter',middleware.create_rate_limiter(2))


def test_status_polling_cannot_starve_generation(monkeypatch):
 configure(monkeypatch)
 req=request('/v2/preparation')
 for _ in range(3):assert middleware.request_limiter(req)('127.0.0.1')
 assert not middleware.request_limiter(req)('127.0.0.1')
 assert middleware.request_limiter(request('/v1/talk'))('127.0.0.1')
 # Runtime and preparation share the bounded status bucket.
 assert not middleware.request_limiter(request('/v2/runtime'))('127.0.0.1')
 assert not middleware.request_limiter(request('/v2/journal-preparation'))('127.0.0.1')


def test_invalid_credentials_cannot_consume_authenticated_budgets(monkeypatch):
 configure(monkeypatch)
 bad=request('/v2/preparation','wrong')
 for _ in range(2):assert middleware.request_limiter(bad)('127.0.0.1')
 assert not middleware.request_limiter(bad)('127.0.0.1')
 assert middleware.request_limiter(request('/v2/preparation'))('127.0.0.1')
 assert middleware.request_limiter(request('/v1/talk'))('127.0.0.1')


def test_throttle_remains_bounded_and_has_retry_header(monkeypatch):
 configure(monkeypatch)
 async def next_response(req):return Response(status_code=204)
 async def run():
  for _ in range(3):assert (await middleware.rate_limit_middleware(request('/v2/preparation'),next_response)).status_code==204
  response=await middleware.rate_limit_middleware(request('/v2/preparation'),next_response)
  assert response.status_code==429
  assert response.headers['retry-after']=='60'
  assert response.headers['cache-control']=='no-store'
 asyncio.run(run())

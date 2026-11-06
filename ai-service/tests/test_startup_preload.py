import asyncio,threading
from importlib import import_module
from types import SimpleNamespace as NS
import pytest
lifecycle=import_module('app.core.lifespan')

@pytest.mark.parametrize('failure',[False,True])
def test_startup_preload_runs_in_background_and_reports_sanitized_state(monkeypatch,failure):
 from app.core.config import Settings
 from app.model import text_transport
 settings=Settings(app_env='test',core_models_enabled=True,core_transport='text_memory',ai_service_token='x'*32,echo_buddy_enabled=True)
 monkeypatch.setattr(lifecycle,'get_settings',lambda:settings)
 entered=threading.Event();finish=threading.Event();closed=[]
 class Fake:
  def __init__(self,settings):pass
  def preload(self,cancelled):
   entered.set();finish.wait(2)
   if failure:raise RuntimeError('private path and credential sentinel')
  def release(self):closed.append(True)
 monkeypatch.setattr(text_transport,'TextRuntime',Fake)
 monkeypatch.setattr(lifecycle,'ModelRegistry',lambda settings:NS(close=lambda:None))
 app=NS(state=NS())
 async def run():
  async with lifecycle.lifespan(app):
   for _ in range(100):
    if entered.is_set():break
    await asyncio.sleep(.01)
   assert entered.is_set() and app.state.buddy_startup=={'state':'loading'}
   finish.set()
   for _ in range(100):
    if app.state.buddy_startup['state']!='loading':break
    await asyncio.sleep(.01)
   assert app.state.buddy_startup==({'state':'failed','code':'BUDDY_STARTUP_PRELOAD_FAILED'} if failure else {'state':'ready'})
 asyncio.run(run());assert closed==[True]

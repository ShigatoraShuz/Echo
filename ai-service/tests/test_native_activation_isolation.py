"""Fail closed before model loading, worker callbacks or plaintext IPC can start."""
import asyncio
from importlib import import_module
from types import SimpleNamespace

import pytest

lifecycle = import_module("app.core.lifespan")


@pytest.mark.parametrize("core,worker", [(True, False), (False, True), (True, True)])
def test_unapproved_native_profile_cannot_start(core, worker, monkeypatch):
    settings = SimpleNamespace(core_models_enabled=core, worker_enabled=worker)
    monkeypatch.setattr(lifecycle, "get_settings", lambda: settings)

    def forbidden(*args, **kwargs):
        raise AssertionError("No runtime or registry may be constructed")

    monkeypatch.setattr(lifecycle.ModelRuntime, "from_settings", forbidden)
    monkeypatch.setattr(lifecycle, "ModelRegistry", forbidden)
    app = SimpleNamespace(state=SimpleNamespace())

    async def start():
        async with lifecycle.lifespan(app):
            raise AssertionError("Unapproved startup must never succeed")

    with pytest.raises(ValueError, match="privacy-safe.*reproducible"):
        asyncio.run(start())
    assert not vars(app.state)

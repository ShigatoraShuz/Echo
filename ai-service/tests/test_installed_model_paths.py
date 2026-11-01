"""Configuration checks only: no artifact loading, network, database, or inference."""
from pathlib import Path

from app.core.config import Settings
from app.model.runtime import ModelRuntime


def test_native_and_registry_defaults_resolve_to_this_checkout_after_cwd_changes(tmp_path, monkeypatch):
    monkeypatch.delenv("MODELS_ROOT", raising=False)
    monkeypatch.delenv("ECHO_MODELS_DIR", raising=False)
    monkeypatch.chdir(tmp_path)
    settings = Settings(_env_file=None)
    expected = Path(__file__).resolve().parents[2] / "backend" / "models"
    assert Path(settings.models_root).is_absolute()
    assert Path(settings.models_root) == expected
    assert settings.echo_models_dir == expected


def test_explicit_native_root_is_preserved_without_changing_registry_selection(tmp_path, monkeypatch):
    native = tmp_path / "separate native bundle"
    monkeypatch.setenv("MODELS_ROOT", str(native))
    monkeypatch.delenv("ECHO_MODELS_DIR", raising=False)
    monkeypatch.delenv("ECHO_ACTIVE_MODELS", raising=False)
    settings = Settings(_env_file=None)
    assert Path(settings.models_root) == native
    assert settings.echo_models_dir != native
    assert settings.echo_active_models == {}


def test_local_artifact_path_does_not_activate_native_workers_or_placeholder(tmp_path, monkeypatch):
    for key in ("CORE_MODELS_ENABLED", "WORKER_ENABLED", "REALTIME_TALK_ENABLED"):
        monkeypatch.delenv(key, raising=False)
    settings = Settings(_env_file=None, models_root=str(tmp_path), lora_adapter_path=str(tmp_path))
    assert not settings.core_models_enabled
    assert not settings.worker_enabled
    assert not settings.realtime_talk_enabled
    assert not ModelRuntime.from_settings(settings).loaded

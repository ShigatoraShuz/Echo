"""DLL search scope only; no models, native DLLs, audio, network or database."""
import os
import sys
from contextlib import contextmanager

import pytest

from app.speech_worker import cuda12_search_path


def test_official_environment_dll_paths_are_scoped_and_restored(tmp_path, monkeypatch):
    if os.name != "nt":
        pytest.skip("Windows-specific loader path")
    for name in ("cublas", "cudnn"):
        (tmp_path / "Lib/site-packages/nvidia" / name / "bin").mkdir(parents=True)
    opened = []
    closed = []
    @contextmanager
    def fake_directory(path):
        opened.append(path)
        try:
            yield
        finally:
            closed.append(path)
    monkeypatch.setattr(os, "add_dll_directory", fake_directory)
    monkeypatch.setattr(sys, "prefix", str(tmp_path))
    monkeypatch.setenv("PATH", "original-path")
    with pytest.raises(RuntimeError), cuda12_search_path():
        assert "cublas" in os.environ["PATH"] and "cudnn" in os.environ["PATH"]
        raise RuntimeError("Synthetic loader failure")
    assert os.environ["PATH"] == "original-path" and len(opened) == 2 and len(closed) == 2

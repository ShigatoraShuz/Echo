import base64
import subprocess
from pathlib import Path

import pytest

from app.model.core import CoreRuntime


def test_face_subprocess_error_removes_transient_image(tmp_path, monkeypatch):
    runtime = CoreRuntime.__new__(CoreRuntime)
    runtime.root = tmp_path / "models"
    runtime.root.mkdir()
    (tmp_path / "runtime-cache").mkdir()
    runtime.call = lambda name, fn: fn(None)

    def fail(command, **kwargs):
        assert Path(command[-2]).read_bytes() == b"synthetic"
        raise subprocess.TimeoutExpired(command, 90)

    monkeypatch.setattr(subprocess, "run", fail)
    with pytest.raises(subprocess.TimeoutExpired):
        runtime.face(base64.b64encode(b"synthetic").decode())
    assert not list((tmp_path / "runtime-cache").iterdir())


def test_face_rejects_invalid_and_oversized_payload_before_starting_child():
    runtime = CoreRuntime.__new__(CoreRuntime)
    runtime.call = lambda *args: pytest.fail("Child must not run")
    for value in ["", "%%%not-base64", base64.b64encode(b"x" * (2 * 1024 * 1024 + 1)).decode()]:
        with pytest.raises(ValueError):
            runtime.face(value)

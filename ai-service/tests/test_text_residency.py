"""Loader scheduling with tiny objects; real-checkpoint timings are separate HTTP evidence."""
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.model.core import CoreRuntime


@pytest.fixture
def cached_runtime(monkeypatch):
    free = [16 * 1024**3]
    loads = []

    def load(name):
        loads.append(name)
        return object()

    monkeypatch.setitem(sys.modules, "torch", SimpleNamespace(cuda=SimpleNamespace(
        empty_cache=lambda: None, mem_get_info=lambda: (free[0], 16 * 1024**3))))
    monkeypatch.setitem(sys.modules, "app.vendor.xlmr.classifier", SimpleNamespace(Classifier=lambda *a, **kw: load("xlmr")))
    monkeypatch.setitem(sys.modules, "app.vendor.e4.model", SimpleNamespace(load_model=lambda *a, **kw: load("e4")))
    runtime = CoreRuntime.__new__(CoreRuntime)
    runtime.root, runtime.active, runtime.instance = Path("fictional"), None, None
    runtime.resident, runtime.load_milliseconds = {}, {}
    return runtime, free, loads


def test_classifier_and_companion_reuse_weights_and_release_together(cached_runtime):
    runtime, _, loads = cached_runtime
    classifier, emotions = runtime._load("xlmr"), runtime._load("e4")
    assert runtime._load("xlmr") is classifier
    assert runtime._load("e4") is emotions
    assert loads == ["xlmr", "e4"]
    assert set(runtime.resident) == {"xlmr", "e4"}
    runtime.release()
    assert runtime.resident == {} and runtime.instance is None


def test_low_memory_falls_back_to_a_single_model(cached_runtime):
    runtime, free, loads = cached_runtime
    runtime._load("xlmr")
    free[0] = 3 * 1024**3
    runtime._load("e4")
    assert set(runtime.resident) == {"e4"}
    assert loads == ["xlmr", "e4"]


def test_available_memory_keeps_other_text_models_between_journal_and_buddy(cached_runtime):
    runtime, _, loads = cached_runtime
    writer = object()
    runtime.resident["cbt"] = writer
    runtime._load("xlmr")
    runtime._load("e4")
    assert runtime._load("cbt") is writer
    assert set(runtime.resident) == {"xlmr", "e4", "cbt"}
    assert loads == ["xlmr", "e4"]

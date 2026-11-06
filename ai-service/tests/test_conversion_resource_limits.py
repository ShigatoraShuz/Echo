"""Unit and small Windows job checks; never load production models."""
import json
import mmap
import os
from pathlib import Path
import subprocess
import sys
import pytest

SCRIPTS = Path(__file__).resolve().parents[2] / "scripts"
sys.path.insert(0, str(SCRIPTS))
from windows_resource_limits import Policy, LimitedJob, Extended, CPU, run_limited


def test_default_policy_uses_decimal_28gb_and_60_percent():
    assert Policy().memory_bytes == 28_000_000_000
    assert Policy().cpu_percent == 60


@pytest.mark.parametrize("options", [{"memory_bytes": 28_000_000_001}, {"cpu_percent": 61}, {"memory_bytes": 0}, {"cpu_percent": 0}])
def test_policy_rejects_unsafe_budgets(options):
    with pytest.raises(ValueError):
        Policy(**options)


@pytest.mark.skipif(os.name != "nt", reason="Windows job API acceptance")
def test_real_job_reports_configured_hard_caps():
    job = LimitedJob(Policy(memory_bytes=192*1024**2, cpu_percent=20))
    try:
        limits = job.query(9, Extended())
        cpu = job.query(15, CPU())
        assert limits.job_memory == 192*1024**2
        assert limits.basic.flags & 0x200
        assert cpu.flags & 5 == 5
        assert cpu.rate == 2000
    finally:
        job.close()


@pytest.mark.skipif(os.name != "nt", reason="Windows job API acceptance")
def test_worker_and_spawned_child_inherit_caps():
    child = "import sys;sys.path.insert(0," + repr(str(SCRIPTS)) + ");from windows_resource_limits import assert_current_limits;assert_current_limits()"
    parent = "import subprocess,sys;subprocess.run([sys.executable,'-c'," + repr(child) + "],check=True)"
    assert run_limited([sys.executable, "-c", parent], Policy(memory_bytes=192*1024**2, cpu_percent=20)) == 0


@pytest.mark.skipif(os.name != "nt", reason="Windows job API acceptance")
def test_allocation_above_job_memory_budget_is_denied():
    child = "import sys\ntry:\n x=bytearray(256*1024**2)\nexcept MemoryError:\n sys.exit(17)\nsys.exit(1)"
    assert run_limited([sys.executable, "-c", child], Policy(memory_bytes=192*1024**2, cpu_percent=20)) == 17


@pytest.mark.skipif(os.name != "nt", reason="Windows job API acceptance")
def test_hidden_worker_flag_cannot_run_without_limits():
    environment=dict(os.environ)
    environment.pop('ECHO_CONVERSION_JOB_NAME',None)
    result = subprocess.run([sys.executable, str(SCRIPTS / "prepare-cbt-gguf.py"), "--limited-worker"], capture_output=True, text=True, timeout=30,env=environment)
    assert result.returncode != 0
    assert 'verifying_sources' not in result.stdout


@pytest.mark.skipif(os.name != "nt", reason="Windows job API acceptance")
def test_default_os_caps_are_28gb_and_60_percent():
    job = LimitedJob()
    try:
        assert 0 <= 28_000_000_000 - job.query(9, Extended()).job_memory < mmap.PAGESIZE
        assert job.query(15, CPU()).rate == 6000
    finally:
        job.close()


@pytest.mark.skipif(os.name != "nt", reason="Windows job API acceptance")
def test_working_set_watchdog_stops_owned_tree(monkeypatch):
    monkeypatch.setattr(LimitedJob, "working_set", lambda self: self.policy.memory_bytes + 1)
    with pytest.raises(MemoryError, match="RAM budget"):
        run_limited([sys.executable, "-c", "import time;time.sleep(10)"], Policy(memory_bytes=192*1024**2))

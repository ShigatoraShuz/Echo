"""Windows-only process-tree resource limits for explicit local setup work."""
from __future__ import annotations
import ctypes as c
from ctypes import wintypes as w
from dataclasses import dataclass
import json
import os
import subprocess
import sys
import time
import uuid

DEFAULT_MEMORY_BYTES = 28_000_000_000  # decimal GB, deliberately below 28 GiB
DEFAULT_CPU_PERCENT = 60
CREATE_SUSPENDED = 0x4  # Win32 flag is not exported by every Python subprocess build


@dataclass(frozen=True)
class Policy:
    memory_bytes: int = DEFAULT_MEMORY_BYTES
    cpu_percent: int = DEFAULT_CPU_PERCENT

    def __post_init__(self):
        if not 1 <= self.memory_bytes <= DEFAULT_MEMORY_BYTES:
            raise ValueError("Memory budget must not exceed 28 GB")
        if not 1 <= self.cpu_percent <= DEFAULT_CPU_PERCENT:
            raise ValueError("CPU budget must not exceed 60 percent")


class Basic(c.Structure):
    _fields_ = [("process_time", c.c_longlong), ("job_time", c.c_longlong),
        ("flags", w.DWORD), ("min_working", c.c_size_t), ("max_working", c.c_size_t),
        ("active", w.DWORD), ("affinity", c.c_size_t), ("priority", w.DWORD), ("scheduling", w.DWORD)]


class IO(c.Structure):
    _fields_ = [(name, c.c_ulonglong) for name in
        ("read_ops", "write_ops", "other_ops", "read_bytes", "write_bytes", "other_bytes")]


class Extended(c.Structure):
    _fields_ = [("basic", Basic), ("io", IO), ("process_memory", c.c_size_t),
        ("job_memory", c.c_size_t), ("peak_process", c.c_size_t), ("peak_job", c.c_size_t)]


class CPU(c.Structure):
    _fields_ = [("flags", w.DWORD), ("rate", w.DWORD)]


class Memory(c.Structure):
    _fields_ = [("cb", w.DWORD), ("faults", w.DWORD)] + [(name, c.c_size_t) for name in
        ("peak_working", "working", "peak_paged", "paged", "peak_nonpaged", "nonpaged", "pagefile", "peak_pagefile", "private")]


class Pids(c.Structure):
    _fields_ = [("assigned", w.DWORD), ("count", w.DWORD), ("ids", c.c_size_t * 1024)]


def api():
    if os.name != "nt":
        raise RuntimeError("Windows resource limits are required; refusing unrestricted execution")
    library = c.WinDLL("kernel32", use_last_error=True)
    signatures = {
        "CreateJobObjectW": ([c.c_void_p, w.LPCWSTR], w.HANDLE),
        "OpenJobObjectW": ([w.DWORD, w.BOOL, w.LPCWSTR], w.HANDLE),
        "GetCurrentProcess": ([], w.HANDLE),
        "IsProcessInJob": ([w.HANDLE, w.HANDLE, c.POINTER(w.BOOL)], w.BOOL),
        "SetInformationJobObject": ([w.HANDLE, c.c_int, c.c_void_p, w.DWORD], w.BOOL),
        "QueryInformationJobObject": ([w.HANDLE, c.c_int, c.c_void_p, w.DWORD, c.c_void_p], w.BOOL),
        "AssignProcessToJobObject": ([w.HANDLE, w.HANDLE], w.BOOL),
        "TerminateJobObject": ([w.HANDLE, w.UINT], w.BOOL),
        "OpenProcess": ([w.DWORD, w.BOOL, w.DWORD], w.HANDLE),
        "K32GetProcessMemoryInfo": ([w.HANDLE, c.c_void_p, w.DWORD], w.BOOL),
        "CloseHandle": ([w.HANDLE], w.BOOL),
    }
    for name, (arguments, result) in signatures.items():
        getattr(library, name).argtypes = arguments
        getattr(library, name).restype = result
    return library


def require(ok):
    if not ok:
        raise c.WinError(c.get_last_error())


def assert_current_limits(policy=Policy()):
    library = api()
    name = os.environ.get("ECHO_CONVERSION_JOB_NAME")
    if not name or not name.startswith("Local\\EchoConversion-"):
        raise RuntimeError("Worker is missing its required resource-limited job")
    handle = library.OpenJobObjectW(4, False, name)  # JOB_OBJECT_QUERY
    require(handle)
    try:
        member = w.BOOL()
        require(library.IsProcessInJob(library.GetCurrentProcess(), handle, c.byref(member)))
        if not member.value:
            raise RuntimeError("Worker does not belong to its resource-limited job")
        limits, cpu = Extended(), CPU()
        require(library.QueryInformationJobObject(handle, 9, c.byref(limits), c.sizeof(limits), None))
        require(library.QueryInformationJobObject(handle, 15, c.byref(cpu), c.sizeof(cpu), None))
        if not limits.basic.flags & 0x200 or not 0 < limits.job_memory <= policy.memory_bytes:
            raise RuntimeError("Worker is missing its required job-memory limit")
        if cpu.flags & 5 != 5 or not 0 < cpu.rate <= policy.cpu_percent * 100:
            raise RuntimeError("Worker is missing its required CPU hard cap")
    finally:
        library.CloseHandle(handle)


class LimitedJob:
    def __init__(self, policy=Policy()):
        self.policy = policy
        self.library = api()
        self.name = "Local\\EchoConversion-" + uuid.uuid4().hex
        self.handle = self.library.CreateJobObjectW(None, self.name)
        require(self.handle)
        try:
            limits = Extended()
            limits.basic.flags = 0x2000 | 0x200  # kill on close + aggregate job committed-memory cap
            limits.job_memory = policy.memory_bytes
            require(self.library.SetInformationJobObject(self.handle, 9, c.byref(limits), c.sizeof(limits)))
            cpu = CPU(5, policy.cpu_percent * 100)  # enabled, hard cap
            require(self.library.SetInformationJobObject(self.handle, 15, c.byref(cpu), c.sizeof(cpu)))
        except BaseException:
            self.close()
            raise

    def query(self, kind, structure):
        require(self.library.QueryInformationJobObject(self.handle, kind, c.byref(structure), c.sizeof(structure), None))
        return structure

    def attach_and_resume(self, process):
        require(self.library.AssignProcessToJobObject(self.handle, int(process._handle)))
        native = c.WinDLL("ntdll")
        native.NtResumeProcess.argtypes = [w.HANDLE]
        native.NtResumeProcess.restype = c.c_long
        if native.NtResumeProcess(int(process._handle)) != 0:
            raise RuntimeError("Could not resume resource-limited worker")

    def working_set(self):
        pids = self.query(3, Pids())
        total = 0
        for pid in pids.ids[:pids.count]:
            handle = self.library.OpenProcess(0x410, False, pid)
            if not handle:
                # A child can exit between the job query and opening its handle.
                if c.get_last_error() == 87:
                    continue
                raise c.WinError(c.get_last_error())
            try:
                memory = Memory()
                memory.cb = c.sizeof(memory)
                if self.library.K32GetProcessMemoryInfo(handle, c.byref(memory), c.sizeof(memory)):
                    total += memory.working
                else:
                    # Confirm disappearance rather than treating an unreadable live process as zero.
                    remaining = self.query(3, Pids())
                    if pid in remaining.ids[:remaining.count]:
                        raise c.WinError(c.get_last_error())
            finally:
                self.library.CloseHandle(handle)
        return total

    def close(self):
        if self.handle:
            handle, self.handle = self.handle, None
            self.library.CloseHandle(handle)


def run_limited(command, policy=Policy(), env=None):
    job = LimitedJob(policy)
    process = None
    peak_working = 0
    try:
        child_env = dict(os.environ if env is None else env)
        child_env["ECHO_CONVERSION_JOB_NAME"] = job.name
        process = subprocess.Popen(command, env=child_env, stdout=sys.stdout, stderr=sys.stderr,
            creationflags=CREATE_SUSPENDED | subprocess.CREATE_NO_WINDOW)
        job.attach_and_resume(process)
        print(json.dumps({"stage": "resource_limits", "memoryBytes": policy.memory_bytes,
            "cpuPercent": policy.cpu_percent,
            "enforcedCommittedMemoryBytes": job.query(9, Extended()).job_memory,
            "scope": "conversion process tree",
            "memoryEnforcement": "hard job commit cap plus monitored aggregate working set"}), flush=True)
        while process.poll() is None:
            working = job.working_set()
            peak_working = max(peak_working, working)
            if working >= policy.memory_bytes:
                require(job.library.TerminateJobObject(job.handle, 137))
                process.wait(timeout=15)
                raise MemoryError("Conversion stopped at its aggregate RAM budget")
            time.sleep(0.1)
        limits = job.query(9, Extended())
        print(json.dumps({"stage": "resource_usage", "peakCommittedBytes": limits.peak_job,
            "peakSampledWorkingSetBytes": peak_working, "returnCode": process.returncode}), flush=True)
        return process.returncode
    finally:
        job.close()  # descendants are contained and terminated on failure/controller exit
        if process and process.poll() is None:
            process.kill()
            process.wait(timeout=15)

"""Windows jobs contain only processes spawned here; no process enumeration."""
import os
import subprocess
import threading

class WindowsJob:
    def __init__(self):
        import ctypes as c
        from ctypes import wintypes as w
        self.lock = threading.Lock()
        self.c = c
        self.api = c.WinDLL("kernel32", use_last_error=True)
        class Basic(c.Structure):
            _fields_ = [("process_time", c.c_longlong), ("job_time", c.c_longlong),
                ("flags", w.DWORD), ("min_working", c.c_size_t), ("max_working", c.c_size_t),
                ("active", w.DWORD), ("affinity", c.c_size_t),
                ("priority", w.DWORD), ("scheduling", w.DWORD)]
        class IO(c.Structure):
            _fields_ = [(name, c.c_ulonglong) for name in
                ("read_ops", "write_ops", "other_ops", "read_bytes", "write_bytes", "other_bytes")]
        class Extended(c.Structure):
            _fields_ = [("basic", Basic), ("io", IO), ("process_memory", c.c_size_t),
                ("job_memory", c.c_size_t), ("peak_process", c.c_size_t), ("peak_job", c.c_size_t)]
        self.api.CreateJobObjectW.argtypes = [c.c_void_p, w.LPCWSTR]
        self.api.CreateJobObjectW.restype = w.HANDLE
        self.api.SetInformationJobObject.argtypes = [w.HANDLE, c.c_int, c.c_void_p, w.DWORD]
        self.api.SetInformationJobObject.restype = w.BOOL
        self.api.AssignProcessToJobObject.argtypes = [w.HANDLE, w.HANDLE]
        self.api.AssignProcessToJobObject.restype = w.BOOL
        self.api.CloseHandle.argtypes = [w.HANDLE]
        self.api.CloseHandle.restype = w.BOOL
        self.handle = self.api.CreateJobObjectW(None, None)
        if not self.handle:
            raise c.WinError(c.get_last_error())
        info = Extended()
        info.basic.flags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        if not self.api.SetInformationJobObject(self.handle, 9, c.byref(info), c.sizeof(info)):
            error = c.WinError(c.get_last_error()); self.close(); raise error

    def attach_and_resume(self, process):
        if not self.api.AssignProcessToJobObject(self.handle, int(process._handle)):
            raise self.c.WinError(self.c.get_last_error())
        ntdll = self.c.WinDLL("ntdll")
        ntdll.NtResumeProcess.argtypes = [self.c.c_void_p]
        ntdll.NtResumeProcess.restype = self.c.c_long
        if ntdll.NtResumeProcess(int(process._handle)) != 0:
            raise OSError("Could not resume owned worker")

    def close(self):
        with self.lock:
            if self.handle:
                handle, self.handle = self.handle, None
                self.api.CloseHandle(handle)

def spawn_owned(args, **kwargs):
    if os.name != "nt":
        return subprocess.Popen(args, **kwargs)
    job = WindowsJob()
    process = None
    try:
        # Attach before the venv launcher can create its Python child.
        kwargs["creationflags"] = kwargs.get("creationflags", 0) | 0x4  # CREATE_SUSPENDED
        process = subprocess.Popen(args, **kwargs)
        job.attach_and_resume(process)
        process._buddy_job = job
        return process
    except Exception:
        job.close()
        if process:
            if process.poll() is None:
                process.kill()
            process.wait(timeout=10)
        raise

def terminate_owned(process):
    job = getattr(process, "_buddy_job", None)
    if job:
        job.close()
    elif process.poll() is None:
        process.kill()
    process.wait(timeout=10)


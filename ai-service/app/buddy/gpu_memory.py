"""Driver-wide GPU memory; never substitute a process-local CUDA estimate."""
import ctypes
import os
import uuid
from app.core.exceptions import ModelUnavailableError

class Memory(ctypes.Structure):
    _fields_ = [("total",ctypes.c_ulonglong),("free",ctypes.c_ulonglong),("used",ctypes.c_ulonglong)]

def _read_nvml(identity, index):
    if os.name == "nt":
        path = os.path.join(os.environ.get("SYSTEMROOT", "C:/Windows"), "System32", "nvml.dll")
        library = ctypes.CDLL(path)
    else:
        library = ctypes.CDLL("libnvidia-ml.so.1")
    library.nvmlInit_v2.restype = ctypes.c_uint
    library.nvmlShutdown.restype = ctypes.c_uint
    if library.nvmlInit_v2() != 0:
        raise OSError("NVML initialization failed")
    try:
        handle = ctypes.c_void_p()
        if identity:
            function = library.nvmlDeviceGetHandleByUUID
            function.argtypes = [ctypes.c_char_p, ctypes.POINTER(ctypes.c_void_p)]
            function.restype = ctypes.c_uint
            code = function(identity.encode("ascii"), ctypes.byref(handle))
        else:
            function = library.nvmlDeviceGetHandleByIndex_v2
            function.argtypes = [ctypes.c_uint, ctypes.POINTER(ctypes.c_void_p)]
            function.restype = ctypes.c_uint
            code = function(index, ctypes.byref(handle))
        if code:
            raise OSError("NVML device selection failed")
        function = library.nvmlDeviceGetMemoryInfo
        function.argtypes = [ctypes.c_void_p, ctypes.POINTER(Memory)]
        function.restype = ctypes.c_uint
        value = Memory()
        if function(handle, ctypes.byref(value)):
            raise OSError("NVML memory query failed")
        return {"freeBytes": int(value.free), "totalBytes": int(value.total), "source": "nvml"}
    finally:
        library.nvmlShutdown()

def global_memory(torch):
    try:
        index = torch.cuda.current_device()
        value = getattr(torch.cuda.get_device_properties(index), "uuid", None)
        identity = value if isinstance(value, str) and value.startswith("GPU-") else None
        if value is not None and not identity and hasattr(value, "bytes"):
            identity = "GPU-" + str(uuid.UUID(bytes=bytes(value.bytes)))
        if identity is None:
            visible = os.environ.get("CUDA_VISIBLE_DEVICES", "")
            if visible:
                selected = visible.split(",")[index].strip()
                if selected.startswith("GPU-"):
                    identity = selected
                else:
                    index = int(selected)
        memory = _read_nvml(identity, index)
        if not 0 <= memory["freeBytes"] <= memory["totalBytes"] or memory["totalBytes"] <= 0:
            raise ValueError("Invalid GPU memory")
        return memory
    except (OSError, ValueError, AttributeError, IndexError):
        raise ModelUnavailableError("BUDDY_GPU_MEMORY_UNAVAILABLE") from None

def require_headroom(torch, additional_bytes=0):
    memory = global_memory(torch)
    if memory["freeBytes"] - additional_bytes < 2 * 1024**3:
        raise ModelUnavailableError("BUDDY_INSUFFICIENT_GPU_HEADROOM")
    return memory


"""Explicit synthetic Buddy acceptance; no accounts or microphone recordings are used."""
import hashlib
import argparse
import base64
import re
import threading
import ctypes
import json
from pathlib import Path
import sys
import time
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ai-service"))
from app.buddy.process import Process
from app.buddy.config import paths
from app.buddy.text_audio import prepare
from app.buddy.sentences import sentences, batches
from app.core.exceptions import TalkCancelledError


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--configured",action="store_true",help="Use the configured CBT interpreter rather than the current one")
    parser.add_argument("--speech",action="store_true",help="Also prepare configured Nano/Whisper and synthesize one approved response")
    parser.add_argument("--cancel-recover",action="store_true",help="Cancel an active request, verify child exit, then warm a replacement worker")
    args=parser.parse_args()
    worker = Process(paths()["cbt"] if args.configured else Path(sys.executable), "cbt")
    speech={}
    try:
        started = time.perf_counter()
        identity = worker.call({"check": True})
        print(json.dumps({"stage": "ready", "seconds": time.perf_counter()-started, "identity": identity}), flush=True)
        original = worker.call({"stats": True})
        print(json.dumps({"stage": "residency_before", **original}), flush=True)
        for kind in (("nano","whisper") if args.speech else ()):
            speech[kind]=Process(paths()[kind],kind)
            checked=speech[kind].call({"check":True})
            print(json.dumps({"stage":"speech_ready","component":kind,"model":checked.get("model"),
                "freeGpuBytes":checked.get("freeGpuBytes")}),flush=True)
        history = []
        for turn,text in enumerate(("I feel overwhelmed by my school assignments. How can I take one small step?",
                     "Please give me a numbered list of three practical steps for getting started on my school assignments.", "How can I make the first step easier tomorrow?")):
            history.append({"role": "user", "content": text})
            reply = worker.call({"messages": history})
            approved = not reply.get("withheld") and bool(reply.get("reply"))
            print(json.dumps({"stage": "turn", "approved": approved, "seconds": reply.get("seconds"),
                "quality": reply.get("quality"), "issues": reply.get("issues"),
                "approvedReplySHA256": hashlib.sha256(reply["reply"].encode()).hexdigest() if approved else None,
                "approvedReplyCharacters": len(reply["reply"]) if approved else 0,
                "numberedSteps": len(re.findall(r"(?:^|\n)\s*\d+[.)]\s+",reply["reply"])) if approved else 0}), flush=True)
            if not approved:
                raise RuntimeError("Synthetic acceptance reply withheld")
            history.append({"role": "assistant", "content": reply["reply"]})
            if args.speech and turn==0:
                prepared=prepare(reply["reply"],"English")
                groups=list(batches(sentences(prepared)))
                if "".join(part for group in groups for part in group)!=prepared:
                    raise RuntimeError("Sentence coverage differs")
                started=time.perf_counter();count=0;byte_count=0
                for group in groups:
                    result=speech["nano"].call({"texts":group})
                    if len(result["segments"])!=len(group):raise RuntimeError("Missing speech segment")
                    for segment in result["segments"]:
                        audio=base64.b64decode(segment["audio"],validate=True)
                        if segment["sampleRate"]!=48000 or segment["channels"]!=2 or not audio or len(audio)%4:
                            raise RuntimeError("Invalid PCM output")
                        count+=1;byte_count+=len(audio)
                print(json.dumps({"stage":"approved_speech","segments":count,"batchSizes":[len(group) for group in groups],
                    "pcmBytes":byte_count,"sampleRate":48000,"channels":2,"seconds":time.perf_counter()-started}),flush=True)
        after = worker.call({"stats": True})
        stable = original["pid"] == after["pid"] and original["serverPid"] == after["serverPid"]
        print(json.dumps({"stage": "residency_after", **after, "stableWorkers": stable}), flush=True)
        if not stable:
            raise RuntimeError("Worker identity changed during ordinary turns")
        for kind,item in speech.items():
            print(json.dumps({"stage":"speech_residency","component":kind,**item.call({"stats":True})}),flush=True)
        if args.cancel_recover:
            cancelled=threading.Event()
            timer=threading.Timer(.15,cancelled.set);timer.start()
            try:
                worker.call({"messages":history+[{"role":"user","content":"Please explain the steps with a little more detail."}]},cancelled)
            except TalkCancelledError:
                print(json.dumps({"stage":"cancelled","workerExited":worker.process.poll() is not None}),flush=True)
            else:
                raise RuntimeError("Cancellation was not observed")
            finally:
                timer.cancel()
            # Query only the known owned native PID. Never kill/enumerate unrelated processes.
            kernel=ctypes.WinDLL("kernel32",use_last_error=True)
            kernel.OpenProcess.argtypes=[ctypes.c_ulong,ctypes.c_int,ctypes.c_ulong]
            kernel.OpenProcess.restype=ctypes.c_void_p
            kernel.WaitForSingleObject.argtypes=[ctypes.c_void_p,ctypes.c_ulong]
            kernel.WaitForSingleObject.restype=ctypes.c_ulong
            kernel.CloseHandle.argtypes=[ctypes.c_void_p]
            handle=kernel.OpenProcess(0x100000,False,after["serverPid"])
            if handle:
                try:
                    if kernel.WaitForSingleObject(handle,10000)!=0:raise RuntimeError("Cancelled server did not exit")
                finally:kernel.CloseHandle(handle)
            elif ctypes.get_last_error()!=87:
                raise OSError("Could not verify cancelled server exit")
            replacement=Process(paths()["cbt"] if args.configured else Path(sys.executable),"cbt")
            worker=replacement
            worker.call({"check":True})
            recovered=worker.call({"stats":True})
            if recovered["serverPid"]==after["serverPid"]:raise RuntimeError("Recovery reused the terminated server")
            print(json.dumps({"stage":"recovered",**recovered}),flush=True)
            reply=worker.call({"messages":history+[{"role":"user","content":"Thanks for the steps. What is one small thing I can start with?"}]})
            if reply.get("withheld") or not reply.get("reply"):raise RuntimeError("Recovery answer withheld")
            print(json.dumps({"stage":"recovery_reply","approved":True,"seconds":reply.get("seconds")}),flush=True)
    finally:
        for item in speech.values():item.close()
        worker.close()


if __name__ == "__main__":
    main()

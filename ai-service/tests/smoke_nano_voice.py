"""Explicit real Nano/Whisper probe; synthetic audio, no microphone or private text."""
import base64, json, os, re, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.buddy.process import Process
from app.buddy.config import paths


def main():
    import numpy as np
    from scipy.signal import resample_poly
    workers = []
    report = {"passed": False, "turns": [], "limitations": ["synthetic audio", "no physical microphone", "ASR consistency is not human listening review"]}
    try:
        nano = Process(paths()["nano"], "nano"); workers.append(nano)
        started = time.perf_counter()
        ready = nano.call({"check": True})
        report["loadSeconds"] = time.perf_counter() - started
        report["provider"] = ready["model"]["providerName"]
        assert report["provider"] == "MOSS-TTS-Nano"
        pid = nano.process.pid
        whisper = Process(paths()["whisper"], "whisper"); workers.append(whisper)
        whisper.call({"check": True})
        for phrase in ["Please place the green pencil on the desk before opening the book.", "We can take one small step and make time to rest today."]:
            started = time.perf_counter()
            result = nano.call({"texts": [phrase], "language": "English"})
            segment = result["segments"][0]
            assert segment["sampleRate"] == 48000 and segment["channels"] == 2
            raw = base64.b64decode(segment["audio"], validate=True)
            assert raw and len(raw) % 4 == 0
            wave = np.frombuffer(raw, dtype="<i2").reshape(-1, 2).astype(np.float32) / 32768
            assert np.isfinite(wave).all() and np.max(np.abs(wave)) > .005
            seconds = time.perf_counter() - started
            mono = resample_poly(wave.mean(axis=1), 1, 3)
            pcm = (np.clip(mono, -1, 1) * 32767).astype("<i2").tobytes()
            text = whisper.call({"audio": base64.b64encode(pcm).decode(), "language": "English"})["text"]
            expected = re.findall("[a-z]+", phrase.lower()); actual = set(re.findall("[a-z]+", text.lower()))
            coverage = sum(word in actual for word in expected) / len(expected)
            row = {"synthesisSeconds": seconds, "durationSeconds": len(wave) / 48000, "asrCoverage": coverage, "sameWorker": nano.process.pid == pid}
            report["turns"].append(row); print(json.dumps(row), flush=True)
            assert coverage >= .75 and row["sameWorker"]
        report["passed"] = True
    except Exception as error:
        code = str(error)
        report["error"] = code if re.fullmatch(r"BUDDY_[A-Z0-9_]{1,70}", code) else type(error).__name__
    finally:
        for worker in reversed(workers): worker.close()
    target = Path(os.environ["ECHO_TEST_REPORT_DIR"]) / "nano-voice-test.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report), flush=True)
    return 0 if report["passed"] else 1


if __name__ == "__main__": raise SystemExit(main())

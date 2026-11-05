"use client";

import Link from "next/link";
import { memo, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { CameraOff, Fingerprint, LoaderCircle, RefreshCw, ScanFace, ShieldCheck } from "lucide-react";
import { facialExpressionResultSchema, type FaceMeshCapture } from "@echo/contracts";
import { env } from "@/config/environment";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";

type CameraState = "idle" | "requesting" | "loading_mesh" | "active" | "denied" | "unavailable" | "error";
type Connection = { start: number; end: number };
export interface JournalFaceCaptureHandle {
  getCapture(): FaceMeshCapture | undefined;
  getStill(): Promise<Blob | undefined>;
  stop(): void;
}
interface Props {
  running: boolean;
}
const MODEL_VERSION = "mediapipe-face-landmarker-float16-v1";

export const JournalFaceCapture = memo(forwardRef<JournalFaceCaptureHandle, Props>(function JournalFaceCapture(
  { running },
  ref,
) {
  const [state, setState] = useState<CameraState>("idle");
  const [hasFace, setHasFace] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [expression, setExpression] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null),
    canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null),
    workerRef = useRef<Worker | null>(null);
  const frames = useRef<ReturnType<typeof setInterval> | null>(null),
    evaluations = useRef<ReturnType<typeof setInterval> | null>(null);
  const busy = useRef(false),
    generation = useRef(0),
    saving = useRef(false);
  const connections = useRef<Connection[]>([]),
    latest = useRef<FaceMeshCapture | undefined>(undefined);
  const stableSince = useRef(0),
    lastAttempt = useRef(0),
    inFlight = useRef<Promise<void> | null>(null);
  const evaluationAbort = useRef<AbortController | null>(null);

  const clearMesh = useCallback(() => {
    const c = canvasRef.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
  }, []);
  const release = useCallback(() => {
    ++generation.current;
    if (frames.current) clearInterval(frames.current);
    if (evaluations.current) clearInterval(evaluations.current);
    frames.current = null;
    evaluations.current = null;
    evaluationAbort.current?.abort();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    workerRef.current?.terminate();
    workerRef.current = null;
    busy.current = false;
    latest.current = undefined;
    stableSince.current = 0;
    clearMesh();
  }, [clearMesh]);
  const stop = useCallback(() => {
    release();
    setState("idle");
    setHasFace(false);
    setEvaluating(false);
    setExpression("");
  }, [release]);

  const snapshot = useCallback(async () => {
    const video = videoRef.current;
    if (
      !latest.current ||
      Date.now() - Date.parse(latest.current.capturedAt) > 2000 ||
      !video?.videoWidth ||
      video.readyState < 2 ||
      !streamRef.current
    )
      return undefined;
    const still = document.createElement("canvas");
    const scale = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
    still.width = Math.round(video.videoWidth * scale);
    still.height = Math.round(video.videoHeight * scale);
    still.getContext("2d")?.drawImage(video, 0, 0, still.width, still.height);
    return new Promise<Blob | undefined>((resolve) =>
      still.toBlob(
        (blob) => {
          still.width = 0;
          still.height = 0;
          resolve(blob ?? undefined);
        },
        "image/jpeg",
        0.9,
      ),
    );
  }, []);
  useImperativeHandle(
    ref,
    () => ({
      getCapture: () =>
        latest.current && Date.now() - Date.parse(latest.current.capturedAt) < 2000 ? latest.current : undefined,
      getStill: async () => {
        saving.current = true;
        // Saving needs a fresh frame, not the result of a previous live preview.
        evaluationAbort.current?.abort();
        return snapshot();
      },
      stop,
    }),
    [snapshot, stop],
  );

  const drawMesh = useCallback((landmarks: number[][]) => {
    const canvas = canvasRef.current,
      video = videoRef.current;
    if (!canvas || !video || landmarks.length !== 478) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const points = landmarks.map(([x, y, z]) => [x * (video.videoWidth || 640), y * (video.videoHeight || 480), z]);
    const xs = points.map((p) => p[0]),
      ys = points.map((p) => p[1]);
    const left = Math.min(...xs),
      right = Math.max(...xs),
      top = Math.min(...ys),
      bottom = Math.max(...ys);
    const scale = Math.min(
      (canvas.width * 0.7) / Math.max(1, right - left),
      (canvas.height * 0.82) / Math.max(1, bottom - top),
    );
    const project = (p: number[]) => [
      canvas.width / 2 - (p[0] - (left + right) / 2) * scale,
      canvas.height / 2 + (p[1] - (top + bottom) / 2) * scale,
    ];
    const projected = points.map(project);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(133,235,194,.48)";
    context.lineWidth = 0.85;
    context.shadowColor = "rgba(97,255,193,.40)";
    context.shadowBlur = 3;
    context.beginPath();
    for (const { start, end } of connections.current) {
      if (!points[start] || !points[end]) continue;
      const a = projected[start],
        b = projected[end];
      context.moveTo(a[0], a[1]);
      context.lineTo(b[0], b[1]);
    }
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = "rgba(216,255,236,.8)";
    context.beginPath();
    for (let i = 0; i < points.length; i += 3) {
      const [x, y] = projected[i];
      context.moveTo(x + 1.25, y);
      context.arc(x, y, 1.25, 0, Math.PI * 2);
    }
    context.fill();
  }, []);

  const evaluate = useCallback(() => {
    if (
      inFlight.current ||
      saving.current ||
      !latest.current ||
      Date.now() - stableSince.current < 650 ||
      Date.now() - lastAttempt.current < 15000
    )
      return;
    const current = generation.current;
    lastAttempt.current = Date.now();
    const abort = new AbortController();
    evaluationAbort.current = abort;
    const operation = (async () => {
      try {
        const image = await snapshot();
        if (!image || current !== generation.current || abort.signal.aborted) return;
        setEvaluating(true);
        const token = await supabaseAuthTokenProvider.getAccessToken();
        if (abort.signal.aborted) return;
        const response = await fetch(env.apiBaseUrl + "/journals/face/evaluate", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg" },
          body: image,
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(65000)]),
        });
        const body = await response.json();
        if (!response.ok) throw Error("Expression analysis is unavailable. The live mesh is still working.");
        const result = facialExpressionResultSchema.parse(body.data);
        if (current === generation.current && !abort.signal.aborted && latest.current)
          setExpression(
            result.status === "available"
              ? `${result.prediction} expression signal`
              : "No usable expression result yet. Adjust your lighting.",
          );
      } catch (error) {
        if (current === generation.current && !abort.signal.aborted && latest.current)
          setExpression(error instanceof Error ? error.message : "Expression analysis is unavailable.");
      } finally {
        if (current === generation.current) setEvaluating(false);
      }
    })();
    inFlight.current = operation;
    void operation.finally(() => {
      if (inFlight.current === operation) inFlight.current = null;
    });
  }, [snapshot]);

  const start = useCallback(async () => {
    release();
    saving.current = false;
    lastAttempt.current = 0;
    const current = generation.current;
    setHasFace(false);
    setExpression("");
    setEvaluating(false);
    setState("requesting");
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      if (current !== generation.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      stream.getVideoTracks?.().forEach((track) =>
        track.addEventListener(
          "ended",
          () => {
            if (current === generation.current) {
              release();
              setHasFace(false);
              setEvaluating(false);
              setExpression("");
              setState("unavailable");
            }
          },
          { once: true },
        ),
      );
      if (!videoRef.current) throw Error("Camera surface unavailable");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      if (current !== generation.current) return;
      setState("loading_mesh");
      const worker = new Worker(new URL("../workers/face-mesh.worker.ts", import.meta.url), { type: "module" });
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent) => {
        if (current !== generation.current) return;
        const message = event.data as {
          type: string;
          connections?: Connection[];
          landmarks?: number[][];
          blendshapes?: FaceMeshCapture["blendshapes"];
        };
        if (message.type === "ready") {
          connections.current = message.connections ?? [];
          setState("active");
          frames.current = setInterval(async () => {
            const video = videoRef.current;
            if (!video || video.readyState < 2 || busy.current || document.hidden) return;
            busy.current = true;
            try {
              const frame = await createImageBitmap(video);
              if (current !== generation.current) {
                frame.close();
                return;
              }
              worker.postMessage({ type: "frame", frame, timestamp: performance.now() }, [frame]);
            } catch {
              busy.current = false;
            }
          }, 100);
          evaluations.current = setInterval(evaluate, 1000);
          return;
        }
        busy.current = false;
        if (message.type === "error") {
          release();
          setState("error");
          setHasFace(false);
          return;
        }
        if (message.type === "result") {
          const landmarks = message.landmarks ?? [],
            blendshapes = message.blendshapes ?? [];
          const valid = landmarks.length === 478 && blendshapes.length === 52;
          setHasFace(valid);
          if (valid) {
            if (!stableSince.current) stableSince.current = Date.now();
            drawMesh(landmarks);
            latest.current = {
              schemaVersion: "echo-face-mesh-v1",
              capturedAt: new Date().toISOString(),
              modelVersion: MODEL_VERSION,
              landmarks: landmarks as FaceMeshCapture["landmarks"],
              blendshapes,
            };
            return;
          }
        }
        latest.current = undefined;
        stableSince.current = 0;
        setHasFace(false);
        clearMesh();
        setExpression("");
      };
      worker.onerror = () => {
        if (current === generation.current) {
          release();
          setState("error");
          setHasFace(false);
        }
      };
      worker.postMessage({
        type: "init",
        wasmRoot: new URL("/vendor/mediapipe", location.origin).toString(),
        modelUrl: new URL("/models/face_landmarker.task", location.origin).toString(),
      });
    } catch (error) {
      if (current !== generation.current) return;
      release();
      setState(
        error instanceof DOMException && ["NotAllowedError", "PermissionDeniedError"].includes(error.name)
          ? "denied"
          : "unavailable",
      );
    }
  }, [clearMesh, drawMesh, evaluate, release]);

  useEffect(() => {
    if (running && !document.hidden) void start();
    else stop();
    const hidden = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      release();
    };
  }, [running, start, stop, release]);

  const failed = ["denied", "unavailable", "error"].includes(state);
  const status =
    state === "requesting"
      ? "Requesting camera permission…"
      : state === "loading_mesh"
        ? "Preparing your live mesh…"
        : state === "active"
          ? hasFace
            ? evaluating
              ? "Facial analysis running"
              : "Face mesh live"
            : "Looking for a face…"
          : state === "denied"
            ? "Camera access is blocked"
            : state === "unavailable"
              ? "No camera is available"
              : state === "error"
                ? "Face tracking could not start"
                : "Ready when you start writing";
  return (
    <section className="journal-face-studio" aria-label="Live facial analysis">
      <header className="face-studio-heading">
        <span className="face-studio-icon">
          <Fingerprint size={21} aria-hidden="true" />
        </span>
        <div>
          <p>PRIVATE FACE STUDIO</p>
          <h3>Live expression mesh</h3>
        </div>
        <span className="face-studio-mode">MESH ONLY</span>
      </header>
      <div className="face-studio-viewport" data-tracking={hasFace}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          aria-hidden="true"
          tabIndex={-1}
          className="absolute h-px w-px opacity-0 pointer-events-none"
        />
        <canvas
          ref={canvasRef}
          width={960}
          height={640}
          role="img"
          aria-label="Live face landmark mesh; camera image is not displayed"
          className="face-studio-canvas"
        />
        <div className="face-studio-grid" aria-hidden="true" />
        <span className="face-studio-bracket face-studio-bracket--tl" />
        <span className="face-studio-bracket face-studio-bracket--tr" />
        <span className="face-studio-bracket face-studio-bracket--bl" />
        <span className="face-studio-bracket face-studio-bracket--br" />
        <div className="face-studio-corner" role="status">
          <span data-live={state === "active" && hasFace} />
          {status}
        </div>
        {!hasFace && (
          <div className="face-studio-empty">
            {failed ? (
              <CameraOff size={32} aria-hidden="true" />
            ) : state === "requesting" || state === "loading_mesh" ? (
              <LoaderCircle size={32} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <ScanFace size={38} aria-hidden="true" />
            )}
            <p>
              {failed
                ? "Allow camera access in your browser, then retry."
                : running
                  ? "Keep your face comfortably in view."
                  : "Your mesh will appear here while you write."}
            </p>
          </div>
        )}
        {hasFace && <div className="face-studio-scan" aria-hidden="true" />}
        <span className="face-studio-watermark" aria-hidden="true">
          ECHO / LIVE LANDMARKS
        </span>
      </div>
      <div className="face-studio-result" aria-live="polite">
        <span className={evaluating ? "face-studio-processing" : ""} />
        <div>
          <p>{evaluating ? "Reading your expression…" : expression || "A quiet layer of understanding"}</p>
          <small>
            {expression
              ? "Uncalibrated model signal, not a measure of how you feel."
              : "The mesh follows your movement. Your camera image stays hidden."}
          </small>
        </div>
      </div>
      {failed && running && (
        <button type="button" onClick={() => void start()} className="echo-button-secondary m-4 mt-0">
          <RefreshCw size={14} aria-hidden="true" />
          Retry camera
        </button>
      )}
      <footer>
        <ShieldCheck size={14} aria-hidden="true" />
        <span>No photo or video is saved. The result is saved with your journal.</span>
      </footer>
      <p className="face-studio-settings">
        Automatic analysis is on. <Link href="/settings/privacy">Manage in Privacy settings</Link>
      </p>
    </section>
  );
}));

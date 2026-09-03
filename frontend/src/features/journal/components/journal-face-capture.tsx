"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Camera, CameraOff, Check, Eye, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import type { FaceMeshCapture } from "@echo/contracts";

type CameraState = "idle" | "requesting" | "loading_mesh" | "active" | "denied" | "unavailable" | "error";
type Connection = { start: number; end: number };

export interface JournalFaceCaptureHandle {
  getCapture(): FaceMeshCapture | undefined;
  stop(): void;
}

interface JournalFaceCaptureProps {
  requested: boolean;
  onRequestedChange(requested: boolean): void;
}

const MODEL_VERSION = "mediapipe-face-landmarker-float16-v1";

export const JournalFaceCapture = forwardRef<JournalFaceCaptureHandle, JournalFaceCaptureProps>(
  function JournalFaceCapture({ requested, onRequestedChange }, ref) {
    const [state, setState] = useState<CameraState>("idle");
    const [hasFace, setHasFace] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const timerRef = useRef<number | null>(null);
    const busyRef = useRef(false);
    const connectionsRef = useRef<Connection[]>([]);
    const latestCaptureRef = useRef<FaceMeshCapture | undefined>(undefined);

    const clearCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }, []);

    const stop = useCallback(() => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      timerRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      workerRef.current?.terminate();
      workerRef.current = null;
      busyRef.current = false;
      latestCaptureRef.current = undefined;
      setHasFace(false);
      clearCanvas();
      setState("idle");
    }, [clearCanvas]);

    useImperativeHandle(ref, () => ({
      getCapture: () => latestCaptureRef.current,
      stop,
    }), [stop]);

    const drawMesh = useCallback((landmarks: number[][]) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video || landmarks.length !== 478) return;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = "rgba(190, 235, 202, .58)";
      context.lineWidth = Math.max(0.65, canvas.width / 900);
      context.beginPath();
      for (const { start, end } of connectionsRef.current) {
        const a = landmarks[start];
        const b = landmarks[end];
        if (!a || !b) continue;
        context.moveTo(a[0] * canvas.width, a[1] * canvas.height);
        context.lineTo(b[0] * canvas.width, b[1] * canvas.height);
      }
      context.stroke();
    }, []);

    const beginFrames = useCallback(() => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      timerRef.current = window.setInterval(async () => {
        const video = videoRef.current;
        const worker = workerRef.current;
        if (!video || !worker || video.readyState < 2 || busyRef.current || document.hidden) return;
        busyRef.current = true;
        try {
          const frame = await createImageBitmap(video);
          worker.postMessage({ type: "frame", frame, timestamp: performance.now() }, [frame]);
        } catch {
          busyRef.current = false;
        }
      }, 100);
    }, []);

    const start = useCallback(async () => {
      onRequestedChange(true);
      latestCaptureRef.current = undefined;
      setHasFace(false);
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
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setState("loading_mesh");
        const worker = new Worker(new URL("../workers/face-mesh.worker.ts", import.meta.url), { type: "module" });
        workerRef.current = worker;
        worker.onmessage = (event: MessageEvent) => {
          const message = event.data as {
            type: "ready" | "result" | "error" | "frame_error";
            connections?: Connection[];
            landmarks?: number[][];
            blendshapes?: Array<{ name: string; score: number }>;
          };
          if (message.type === "ready") {
            connectionsRef.current = message.connections ?? [];
            setState("active");
            beginFrames();
            return;
          }
          if (message.type === "result") {
            busyRef.current = false;
            const landmarks = message.landmarks ?? [];
            const blendshapes = message.blendshapes ?? [];
            const valid = landmarks.length === 478 && blendshapes.length === 52;
            setHasFace(valid);
            if (!valid) {
              latestCaptureRef.current = undefined;
              clearCanvas();
              return;
            }
            drawMesh(landmarks);
            latestCaptureRef.current = {
              schemaVersion: "echo-face-mesh-v1",
              capturedAt: new Date().toISOString(),
              modelVersion: MODEL_VERSION,
              landmarks: landmarks as FaceMeshCapture["landmarks"],
              blendshapes,
            };
            return;
          }
          busyRef.current = false;
          if (message.type === "error") setState("error");
        };
        worker.postMessage({
          type: "init",
          wasmRoot: new URL("/vendor/mediapipe", window.location.origin).toString(),
          modelUrl: new URL("/models/face_landmarker.task", window.location.origin).toString(),
        });
      } catch (error) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setState(error instanceof DOMException && ["NotAllowedError", "PermissionDeniedError"].includes(error.name) ? "denied" : "unavailable");
      }
    }, [beginFrames, clearCanvas, drawMesh, onRequestedChange]);

    useEffect(() => {
      const handleVisibility = () => {
        if (document.hidden) stop();
      };
      document.addEventListener("visibilitychange", handleVisibility);
      return () => {
        document.removeEventListener("visibilitychange", handleVisibility);
        stop();
      };
    }, [stop]);

    useEffect(() => {
      if (!requested && state !== "idle") stop();
    }, [requested, state, stop]);

    const active = state === "active" || state === "loading_mesh";
    const statusText = state === "requesting"
      ? "Requesting camera permission…"
      : state === "loading_mesh"
        ? "Starting the private face mesh…"
        : state === "active" && hasFace
          ? "Face mesh ready"
          : state === "active"
            ? "Center one face in the frame"
            : state === "denied"
              ? "Camera permission was denied"
              : state === "unavailable"
                ? "No camera is available"
                : state === "error"
                  ? "Face mesh could not start"
                  : "Camera stays off until you choose to start it";

    return (
      <section className="overflow-hidden rounded-[1.35rem] border border-primary/15 bg-[linear-gradient(145deg,hsl(var(--card)),hsl(var(--secondary)/.38))] shadow-subtle">
        <div className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Eye className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Optional facial expression capture</h3>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">A live mesh is prepared for your private analysis.</p>
            </div>
          </div>
          {active ? (
            <button type="button" onClick={stop} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-border/70 bg-card px-3 text-xs font-semibold text-foreground transition-[transform,background-color] duration-150 ease-out hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 active:scale-[.97]">
              <CameraOff className="h-3.5 w-3.5" aria-hidden="true" /> Stop
            </button>
          ) : null}
        </div>

        {active ? (
          <div className="relative aspect-video overflow-hidden border-y border-primary/10 bg-[#10231b]">
            <video ref={videoRef} autoPlay muted playsInline className="h-full w-full scale-x-[-1] object-cover" />
            <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1]" aria-hidden="true" />
            <span className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold shadow-sm backdrop-blur ${hasFace ? "bg-emerald-50/90 text-emerald-800" : "bg-card/90 text-muted-foreground"}`}>
              {hasFace ? <Check className="h-3 w-3" /> : <LoaderCircle className="h-3 w-3 animate-spin motion-reduce:animate-none" />}
              {hasFace ? "Mesh ready" : "Finding face"}
            </span>
          </div>
        ) : (
          <div className="mx-4 grid min-h-28 place-items-center rounded-2xl border border-dashed border-primary/20 bg-primary/[.035] px-4 py-5 text-center">
            <Camera className="h-7 w-7 text-primary/55" aria-hidden="true" />
            <p className="mt-2 text-xs text-muted-foreground">{statusText}</p>
            <button type="button" onClick={() => void start()} disabled={state === "requesting"} className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition-transform duration-150 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 active:scale-[.97] disabled:opacity-60">
              {state === "requesting" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : state === "idle" ? <Camera className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {state === "idle" ? "Start camera" : state === "requesting" ? "Requesting…" : "Try again"}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 px-4 py-3 text-[11px] font-medium text-primary/80">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          On-device mesh · no photo or video is saved
        </div>
        <p className="sr-only" aria-live="polite">{statusText}</p>
      </section>
    );
  },
);


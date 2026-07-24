"use client";
import { useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import { EchoCard } from "@/shared/components/ui/echo-card";

type CameraState = "idle" | "requesting" | "active" | "denied" | "unavailable";

export function FacialCameraWidget() {
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);

  async function requestCamera() {
    setCameraState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef) videoRef.srcObject = stream;
      setCameraState("active");
    } catch (err) {
      if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
        setCameraState("denied");
      } else {
        setCameraState("unavailable");
      }
    }
  }

  function stopCamera() {
    if (videoRef?.srcObject) {
      (videoRef.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.srcObject = null;
    }
    setCameraState("idle");
  }

  if (cameraState === "denied") {
    return (
      <EchoCard title="Camera access" description="Permission was denied">
        <div className="flex items-center gap-3 rounded-xl bg-warning/10 p-4">
          <CameraOff className="h-5 w-5 text-warning" />
          <div>
            <p className="text-sm font-medium text-foreground">Camera permission denied</p>
            <p className="text-xs text-muted-foreground">Update your browser settings to allow camera access for facial insights.</p>
          </div>
        </div>
      </EchoCard>
    );
  }

  if (cameraState === "unavailable") {
    return (
      <EchoCard title="Camera access" description="Camera is not available">
        <div className="flex items-center gap-3 rounded-xl bg-secondary/50 p-4">
          <CameraOff className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">No camera detected</p>
            <p className="text-xs text-muted-foreground">Connect a camera to use facial expression analysis.</p>
          </div>
        </div>
      </EchoCard>
    );
  }

  return (
    <EchoCard title="Facial expression" description="Optional camera-based mood insight">
      {cameraState === "active" ? (
        <div className="space-y-3">
          <video ref={setVideoRef} autoPlay muted playsInline className="w-full rounded-xl bg-black" />
          <button type="button" onClick={stopCamera} className="rounded-full bg-danger px-4 py-2 text-sm font-bold text-white hover:bg-danger/90">
            <CameraOff className="mr-1.5 inline h-4 w-4" /> Stop camera
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-center rounded-xl bg-secondary/30 p-8">
            <Camera className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <button type="button" onClick={requestCamera} disabled={cameraState === "requesting"} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {cameraState === "requesting" ? "Requesting..." : "Enable camera"}
          </button>
        </div>
      )}
    </EchoCard>
  );
}

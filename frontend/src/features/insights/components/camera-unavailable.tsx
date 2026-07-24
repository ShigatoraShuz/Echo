"use client";
import { MonitorOff } from "lucide-react";

export function CameraUnavailable() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-secondary/50 text-muted-foreground">
        <MonitorOff className="h-6 w-6" />
      </span>
      <div>
        <h3 className="font-semibold text-foreground">No camera detected</h3>
        <p className="mt-1 text-sm text-muted-foreground">Connect a camera to your device to use facial expression analysis. This feature is optional and all processing happens locally.</p>
      </div>
    </div>
  );
}

"use client";
import { ShieldX, ExternalLink } from "lucide-react";

export function CameraPermissionDenied() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-warning/20 bg-warning/[0.03] p-6 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-warning/10 text-warning">
        <ShieldX className="h-6 w-6" />
      </span>
      <div>
        <h3 className="font-semibold text-foreground">Camera permission denied</h3>
        <p className="mt-1 text-sm text-muted-foreground">Camera access was blocked by your browser. Enable it in your browser settings to use facial expression insights.</p>
      </div>
      <button
        type="button"
        onClick={() => window.open("about:settings", "_blank")}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary/80"
      >
        Open browser settings <ExternalLink className="h-3.5 w-3.5" />
      </button>
      <p className="text-xs text-muted-foreground">Facial analysis is entirely optional and processed locally. No images are uploaded or stored.</p>
    </div>
  );
}

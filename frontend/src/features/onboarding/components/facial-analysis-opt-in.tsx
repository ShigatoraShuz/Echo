"use client";
import { Camera, Info } from "lucide-react";

interface FacialAnalysisOptInProps {
  enabled: boolean;
  onToggle: (value: boolean) => void;
}

export function FacialAnalysisOptIn({ enabled, onToggle }: FacialAnalysisOptInProps) {
  return (
    <div className="rounded-xl border border-primary/10 bg-primary/[0.03] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Camera className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Facial expression analysis</p>
            <p className="text-xs text-muted-foreground">Optionally use your camera for mood insights</p>
          </div>
        </div>
        <button type="button" role="switch" aria-checked={enabled} onClick={() => onToggle(!enabled)} className={elative h-6 w-11 shrink-0 rounded-full transition-colors }>
          <span className={bsolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform } />
        </button>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-lg bg-secondary/30 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>Facial analysis is entirely optional. All processing happens locally in your browser. No images are uploaded or stored.</p>
      </div>
    </div>
  );
}

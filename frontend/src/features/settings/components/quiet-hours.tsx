"use client";
import { useState } from "react";

interface QuietHoursProps {
  startTime: string;
  endTime: string;
  onSave: (start: string, end: string) => void;
  isSaving: boolean;
}

export function QuietHoursSelector({ startTime, endTime, onSave, isSaving }: QuietHoursProps) {
  const [start, setStart] = useState(startTime);
  const [end, setEnd] = useState(endTime);

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-foreground">Quiet hours</p>
      <p className="text-xs text-muted-foreground">Mute notifications during these hours</p>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground">Start</label>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-muted-foreground">End</label>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </div>
      </div>
      <button type="button" onClick={() => onSave(start, end)} disabled={isSaving} className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
        {isSaving ? "Saving..." : "Save quiet hours"}
      </button>
    </div>
  );
}

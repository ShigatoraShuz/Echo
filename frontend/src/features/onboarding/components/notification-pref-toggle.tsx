"use client";
import { Bell } from "lucide-react";

interface NotificationPrefToggleProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
}

export function NotificationPrefToggle({ enabled, onChange }: NotificationPrefToggleProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <Bell className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-foreground">Enable notifications</p>
          <p className="text-xs text-muted-foreground">Receive gentle reminders and updates</p>
        </div>
      </div>
      <button type="button" role="switch" aria-checked={enabled} onClick={() => onChange(!enabled)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-secondary/40"}`}>
        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

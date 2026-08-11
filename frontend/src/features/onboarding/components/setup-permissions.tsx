"use client";
import { Shield, Camera, Bell } from "lucide-react";

interface SetupPermissionsProps {
  cameraEnabled: boolean;
  notificationsEnabled: boolean;
  onToggleCamera: () => void;
  onToggleNotifications: () => void;
}

export function SetupPermissions({ cameraEnabled, notificationsEnabled, onToggleCamera, onToggleNotifications }: SetupPermissionsProps) {
  const items = [
    { key: "camera", label: "Camera access", description: "Optional facial expression insights", icon: Camera, enabled: cameraEnabled, onToggle: onToggleCamera },
    { key: "notifications", label: "Notifications", description: "Journal reminders and insights", icon: Bell, enabled: notificationsEnabled, onToggle: onToggleNotifications },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">Permissions</p>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.key} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            </div>
            <button type="button" role="switch" aria-checked={item.enabled} onClick={item.onToggle} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${item.enabled ? "bg-primary" : "bg-secondary/40"}`}>
              <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${item.enabled ? "translate-x-5" : ""}`} />
            </button>
          </div>
        );
      })}
      <div className="flex items-start gap-2 rounded-lg bg-secondary/30 p-3 text-xs text-muted-foreground">
        <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>These permissions can be changed at any time in Settings. ECHO respects your privacy choices.</p>
      </div>
    </div>
  );
}

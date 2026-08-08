"use client";
import { Shield, Lock, Eye } from "lucide-react";

interface PrivacyControlsProps {
  facialAnalysisEnabled: boolean;
  crisisSupportVisible: boolean;
  lockScreenPrivate: boolean;
  onToggle: (key: string, value: boolean) => void;
}

export function PrivacyControlsSection({ facialAnalysisEnabled, crisisSupportVisible, lockScreenPrivate, onToggle }: PrivacyControlsProps) {
  const items = [
    { key: "facialAnalysisEnabled", label: "Facial expression analysis", description: "Allow optional camera-based mood insights", icon: Eye, enabled: facialAnalysisEnabled },
    { key: "crisisSupportVisible", label: "Crisis support resources", description: "Show crisis support resources in the sidebar", icon: Shield, enabled: crisisSupportVisible },
    { key: "lockScreenPrivate", label: "Lock screen privacy", description: "Hide message previews on the lock screen", icon: Lock, enabled: lockScreenPrivate },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-foreground">Privacy controls</p>
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
            <button
              type="button"
              role="switch"
              aria-checked={item.enabled}
              onClick={() => onToggle(item.key, !item.enabled)}
              className={`relative h-6 w-11 rounded-full transition-colors ${item.enabled ? "bg-primary" : "bg-secondary/40"}`}
            >
              <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${item.enabled ? "translate-x-5" : ""}`} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

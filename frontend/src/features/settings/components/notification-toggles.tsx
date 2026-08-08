"use client";
import { Bell, Mail, Smartphone, BookOpen, BarChart3 } from "lucide-react";

interface NotificationSettingsProps {
  email: boolean;
  push: boolean;
  journal: boolean;
  insights: boolean;
  onToggle: (key: string, value: boolean) => void;
}

export function NotificationToggles({ email, push, journal, insights, onToggle }: NotificationSettingsProps) {
  const items = [
    { key: "email", label: "Email notifications", description: "Receive updates via email", icon: Mail, enabled: email },
    { key: "push", label: "Push notifications", description: "Receive push notifications", icon: Smartphone, enabled: push },
    { key: "journal", label: "Journal reminders", description: "Gentle reminders to journal", icon: BookOpen, enabled: journal },
    { key: "insights", label: "Insight alerts", description: "Notifications about new insights", icon: BarChart3, enabled: insights },
  ];

  return (
    <div className="space-y-3">
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
            <button type="button" role="switch" aria-checked={item.enabled} onClick={() => onToggle(item.key, !item.enabled)} className={`relative h-6 w-11 rounded-full transition-colors ${item.enabled ? "bg-primary" : "bg-secondary/40"}`}>
              <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${item.enabled ? "translate-x-5" : ""}`} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

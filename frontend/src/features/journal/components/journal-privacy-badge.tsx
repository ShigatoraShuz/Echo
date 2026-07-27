"use client";
import { Lock, Globe } from "lucide-react";

interface PrivacyBadgeProps {
  status: "private" | "shared";
}

export function JournalPrivacyBadge({ status }: PrivacyBadgeProps) {
  if (status === "private") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
        <Lock className="h-3 w-3" /> Private
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
      <Globe className="h-3 w-3" /> Shared
    </span>
  );
}

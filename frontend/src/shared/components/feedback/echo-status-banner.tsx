"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { X, Info, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

type BannerVariant = "info" | "success" | "warning" | "error";

interface EchoStatusBannerProps {
  variant?: BannerVariant;
  title: string;
  description?: string;
  dismissible?: boolean;
  className?: string;
}

const config: Record<BannerVariant, { icon: React.ReactNode; container: string; closeHover: string }> = {
  info: {
    icon: <Info className="h-5 w-5" aria-hidden="true" />,
    container: "bg-info text-info-foreground",
    closeHover: "hover:bg-info-foreground/10",
  },
  success: {
    icon: <CheckCircle className="h-5 w-5" aria-hidden="true" />,
    container: "bg-success text-success-foreground",
    closeHover: "hover:bg-success-foreground/10",
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5" aria-hidden="true" />,
    container: "bg-warning text-warning-foreground",
    closeHover: "hover:bg-warning-foreground/10",
  },
  error: {
    icon: <XCircle className="h-5 w-5" aria-hidden="true" />,
    container: "bg-danger text-danger-foreground",
    closeHover: "hover:bg-danger-foreground/10",
  },
};

export function EchoStatusBanner({ variant = "info", title, description, dismissible = false, className }: EchoStatusBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const { icon, container, closeHover } = config[variant];

  return (
    <div className={cn("flex items-start gap-3 px-5 py-4 text-sm", container, className)} role="alert">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-5">{title}</p>
        {description && (
          <p className="mt-0.5 leading-5 opacity-85">{description}</p>
        )}
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className={cn("shrink-0 rounded-lg p-1 outline-none transition focus-visible:ring-4 focus-visible:ring-white/30", closeHover)}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

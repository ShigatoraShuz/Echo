"use client";

import { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface EchoDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: "small" | "medium" | "large";
}

const sizeStyles = {
  small: "max-w-sm",
  medium: "max-w-lg",
  large: "max-w-2xl",
};

export function EchoDialog({ open, onClose, title, description, children, className, size = "medium" }: EchoDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      dialogRef.current?.focus();
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={description ? "dialog-description" : undefined}
        tabIndex={-1}
        className={cn(
          "w-full rounded-2xl bg-card p-6 shadow-dialog outline-none motion-fade-in motion-scale-in",
          sizeStyles[size],
          className
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h2 id="dialog-title" className="text-lg font-semibold text-foreground">{title}</h2>
            {description && (
              <p id="dialog-description" className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/20"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useCallback, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { shouldReduceMotion } from "@/shared/hooks/use-prefers-reduced-motion";

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

let dialogScrollLocks = 0;
let previousBodyOverflow = "";

export function EchoDialog({ open, onClose, title, description, children, className, size = "medium" }: EchoDialogProps) {
  const [present, setPresent] = useState(open);
  const overlayRef = useRef<HTMLDivElement>(null);
  // Presence may mount one render after open; attach the trap only once its
  // DOM exists, including dialogs opened from an initially closed state.
  const dialogRef = useFocusTrap(open && present);
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    },
    []
  );

  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    if (!present) return;
    const timeout = window.setTimeout(() => setPresent(false), shouldReduceMotion() ? 0 : 180);
    return () => window.clearTimeout(timeout);
  }, [open, present]);

  useEffect(() => {
    if (!present) return;
    if (dialogScrollLocks++ === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      if (--dialogScrollLocks === 0) document.body.style.overflow = previousBodyOverflow;
    };
  }, [present]);

  useEffect(() => {
    if (!open || !present) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.addEventListener("keydown", handleKeyDown);
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (!document.querySelector('.echo-dialog-overlay[data-state="open"]')) previousFocus?.focus();
    };
  }, [open, present, handleKeyDown, dialogRef]);

  if (!present) return null;

  return createPortal(
    <div
      ref={overlayRef}
      data-state={open ? "open" : "closing"}
      aria-hidden={!open}
      inert={!open}
      className="echo-dialog-overlay fixed inset-0 z-[400] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (open && e.target === overlayRef.current) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "echo-dialog-panel max-h-[90dvh] w-full overflow-y-auto rounded-2xl bg-card p-6 shadow-dialog outline-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          sizeStyles[size],
          className
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-foreground">{title}</h2>
            {description && (
              <p id={descriptionId} className="text-sm text-muted-foreground">{description}</p>
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
    </div>,
    document.body
  );
}

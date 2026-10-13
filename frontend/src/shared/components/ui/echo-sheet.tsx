"use client";

import { useEffect, useRef, useCallback, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { shouldReduceMotion } from "@/shared/hooks/use-prefers-reduced-motion";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";

interface EchoSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  side?: "left" | "right";
  className?: string;
}

export function EchoSheet({ open, onClose, title, description, children, side = "right", className }: EchoSheetProps) {
  const [present, setPresent] = useState(open);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useFocusTrap(open);
  const titleId = useId();
  const descriptionId = useId();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [present]);

  useEffect(() => {
    if (!open || !present) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.addEventListener("keydown", handleKeyDown);
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [open, present, handleKeyDown, panelRef]);

  if (!present) return null;

  return createPortal(
    <div
      ref={overlayRef}
      data-state={open ? "open" : "closing"}
      data-side={side}
      aria-hidden={!open}
      inert={!open}
      className="echo-sheet-overlay fixed inset-0 z-[400] bg-black/50"
      onClick={(event) => { if (open && event.target === overlayRef.current) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "echo-sheet-panel fixed top-0 bottom-0 flex w-full max-w-md flex-col bg-card shadow-dialog outline-none",
          side === "left" ? "left-0" : "right-0",
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
          <div className="space-y-0.5 min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-foreground">{title}</h2>
            {description && (
              <p id={descriptionId} className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/20"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div data-lenis-prevent className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

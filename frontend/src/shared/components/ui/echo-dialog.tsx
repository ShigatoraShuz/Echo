"use client";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/lib/utils";
interface EchoDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: "small" | "medium" | "large";
  dismissible?: boolean;
}
export function EchoDialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  size = "medium",
  dismissible = true,
}: EchoDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null),
    id = useId(),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby={id}
      aria-describedby={description ? id + "-description" : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) close.current();
      }}
      className={cn(
        "fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-3xl border bg-card p-6 text-foreground shadow-2xl backdrop:bg-black/40",
        size === "large" ? "max-w-2xl" : size === "small" ? "max-w-sm" : "max-w-lg",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id={id} className="font-serif text-2xl">
            {title}
          </h2>
          {description && (
            <p id={id + "-description"} className="mt-2 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {dismissible && (
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-full border"
          >
            ×
          </button>
        )}
      </div>
      <div className="mt-5">{children}</div>
    </dialog>,
    document.body,
  );
}

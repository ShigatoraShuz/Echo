"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

interface EchoTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
  error?: string;
  showCount?: boolean;
}

export const EchoTextarea = forwardRef<HTMLTextAreaElement, EchoTextareaProps>(
  ({ label, description, error, showCount, className, id: externalId, required, maxLength, ...props }, ref) => {
    const generatedId = useId();
    const id = externalId || generatedId;
    const errorId = error ? `${id}-error` : undefined;
    const descriptionId = description ? `${id}-description` : undefined;

    return (
      <div className="space-y-2">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-foreground">
            {label}
            {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          className={cn(
            "min-h-28 w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-danger focus:border-danger focus:ring-danger/10",
            className
          )}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={[errorId, descriptionId].filter(Boolean).join(" ") || undefined}
          maxLength={maxLength}
          required={required}
          {...props}
        />
        <div className="flex items-center justify-between gap-2">
          <div>
            {description && !error && (
              <p id={descriptionId} className="text-xs text-muted-foreground">{description}</p>
            )}
            {error && (
              <p id={errorId} className="text-xs font-medium text-danger" role="alert">{error}</p>
            )}
          </div>
          {showCount && maxLength && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {String(props.value || "").length}/{maxLength}
            </p>
          )}
        </div>
      </div>
    );
  }
);

EchoTextarea.displayName = "EchoTextarea";

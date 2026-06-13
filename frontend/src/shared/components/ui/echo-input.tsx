"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

interface EchoInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const EchoInput = forwardRef<HTMLInputElement, EchoInputProps>(
  ({ label, description, error, leadingIcon, trailingIcon, className, id: externalId, required, ...props }, ref) => {
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
        <div className="relative">
          {leadingIcon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            className={cn(
              "h-11 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50",
              leadingIcon ? "pl-10" : undefined,
              trailingIcon ? "pr-10" : undefined,
              error && "border-danger focus:border-danger focus:ring-danger/10",
              className
            )}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={[errorId, descriptionId].filter(Boolean).join(" ") || undefined}
            required={required}
            {...props}
          />
          {trailingIcon && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {trailingIcon}
            </span>
          )}
        </div>
        {description && !error && (
          <p id={descriptionId} className="text-xs text-muted-foreground">{description}</p>
        )}
        {error && (
          <p id={errorId} className="text-xs font-medium text-danger" role="alert">{error}</p>
        )}
      </div>
    );
  }
);

EchoInput.displayName = "EchoInput";

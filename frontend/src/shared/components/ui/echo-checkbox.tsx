"use client";

import { forwardRef, useId } from "react";
import { Check } from "lucide-react";

interface EchoCheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  description?: string;
  error?: string;
}

export const EchoCheckbox = forwardRef<HTMLInputElement, EchoCheckboxProps>(
  ({ label, description, error, id: externalId, ...props }, ref) => {
    const generatedId = useId();
    const id = externalId || generatedId;
    const errorId = error ? `${id}-error` : undefined;

    return (
      <div className="space-y-1">
        <label htmlFor={id} className="inline-flex cursor-pointer items-start gap-3">
          <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-input bg-background transition has-[:checked]:border-primary has-[:checked]:bg-primary">
            <input
              ref={ref}
              id={id}
              type="checkbox"
              className="peer sr-only"
              aria-invalid={error ? "true" : undefined}
              aria-describedby={errorId}
              {...props}
            />
            <Check className="h-3.5 w-3.5 text-primary-foreground opacity-0 transition peer-checked:opacity-100" aria-hidden="true" />
          </span>
          <span>
            <span className="text-sm font-medium text-foreground">{label}</span>
            {description && (
              <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
            )}
          </span>
        </label>
        {error && (
          <p id={errorId} className="text-xs font-medium text-danger" role="alert">{error}</p>
        )}
      </div>
    );
  }
);

EchoCheckbox.displayName = "EchoCheckbox";

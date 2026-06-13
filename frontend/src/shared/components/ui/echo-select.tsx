"use client";

import { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface EchoSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  description?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const EchoSelect = forwardRef<HTMLSelectElement, EchoSelectProps>(
  ({ label, description, error, options, placeholder, className, id: externalId, required, ...props }, ref) => {
    const generatedId = useId();
    const id = externalId || generatedId;
    const errorId = error ? `${id}-error` : undefined;

    return (
      <div className="space-y-2">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-foreground">
            {label}
            {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={id}
            className={cn(
              "h-11 w-full appearance-none rounded-xl border border-input bg-background px-4 pr-10 text-sm text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-danger focus:border-danger focus:ring-danger/10",
              className
            )}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={errorId}
            required={required}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        </div>
        {description && !error && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {error && (
          <p id={errorId} className="text-xs font-medium text-danger" role="alert">{error}</p>
        )}
      </div>
    );
  }
);

EchoSelect.displayName = "EchoSelect";

"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

interface EchoRadioGroupProps {
  name?: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function EchoRadioGroup({
  name,
  options,
  value,
  onChange,
  label,
  error,
  required,
  disabled,
  className,
}: EchoRadioGroupProps) {
  const generatedId = useId();
  const groupId = `${generatedId}-group`;
  const errorId = error ? `${generatedId}-error` : undefined;

  return (
    <fieldset className={cn("space-y-2", className)} id={groupId}>
      {label && (
        <legend className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
        </legend>
      )}
      <div className="space-y-3">
        {options.map((option) => {
          const optionId = `${generatedId}-${option.value}`;
          return (
            <label key={option.value} htmlFor={optionId} className="inline-flex cursor-pointer items-start gap-3">
              <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-input bg-background transition has-[:checked]:border-primary">
                <input
                  id={optionId}
                  type="radio"
                  name={name || groupId}
                  value={option.value}
                  checked={value === option.value}
                  onChange={(e) => onChange?.(e.target.value)}
                  disabled={disabled}
                  className="peer sr-only"
                  aria-describedby={errorId}
                />
                <span className="h-2.5 w-2.5 rounded-full bg-primary opacity-0 transition peer-checked:opacity-100" />
              </span>
              <span>
                <span className="text-sm font-medium text-foreground">{option.label}</span>
                {option.description && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} className="text-xs font-medium text-danger" role="alert">{error}</p>
      )}
    </fieldset>
  );
}

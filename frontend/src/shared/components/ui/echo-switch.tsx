"use client";

import { forwardRef, useId } from "react";

interface EchoSwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  description?: string;
}

export const EchoSwitch = forwardRef<HTMLInputElement, EchoSwitchProps>(
  ({ label, description, id: externalId, ...props }, ref) => {
    const generatedId = useId();
    const id = externalId || generatedId;

    return (
      <label htmlFor={id} className="inline-flex cursor-pointer items-start gap-3">
        <span className="relative mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full border-2 border-transparent bg-muted-foreground/30 transition has-[:checked]:bg-primary">
          <input
            ref={ref}
            id={id}
            type="checkbox"
            role="switch"
            className="peer sr-only"
            {...props}
          />
          <span className="h-5 w-5 rounded-full bg-background shadow-subtle transition peer-checked:translate-x-4" />
        </span>
        <span>
          <span className="text-sm font-medium text-foreground">{label}</span>
          {description && (
            <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
          )}
        </span>
      </label>
    );
  }
);

EchoSwitch.displayName = "EchoSwitch";

import { ReactNode, useId } from "react";

interface AccessibleFieldProps {
  label: string;
  children: ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
}

export function AccessibleField({ label, children, error, hint, required = false }: AccessibleFieldProps) {
  const fieldId = useId();
  const errorId = useId();
  const hintId = useId();

  return (
    <div role="group" aria-labelledby={fieldId}>
      <label id={fieldId} htmlFor={fieldId}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <div aria-describedby={error ? errorId : hint ? hintId : undefined}>
        {children}
      </div>
      {hint && !error && (
        <p id={hintId} role="note" style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" style={{ fontSize: "0.875rem", color: "var(--color-semantic-error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

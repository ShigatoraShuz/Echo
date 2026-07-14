import type { ReactNode, ChangeEvent } from "react";

interface AuthFormFieldProps {
  label: string;
  type?: string;
  placeholder?: string;
  leadingIcon?: ReactNode;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  required?: boolean;
  autoComplete?: string;
}

export function AuthFormField({
  label,
  type = "text",
  placeholder,
  leadingIcon,
  value,
  onChange,
  error,
  required = false,
  autoComplete,
}: AuthFormFieldProps) {
  const errorId = error ? `${label.toLowerCase().replace(/\s+/g, "-")}-error` : undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={`auth-${label.toLowerCase().replace(/\s+/g, "-")}`} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      <div className="relative">
        {leadingIcon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {leadingIcon}
          </span>
        ) : null}
        <input
          id={`auth-${label.toLowerCase().replace(/\s+/g, "-")}`}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={!!error}
          aria-describedby={errorId}
          className={`h-11 w-full rounded-xl border ${error ? "border-danger" : "border-input"} bg-background pl-${leadingIcon ? "10" : "4"} pr-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10`}
        />
      </div>
      {error ? (
        <p id={errorId} className="text-xs text-danger" role="alert">{error}</p>
      ) : null}
    </div>
  );
}

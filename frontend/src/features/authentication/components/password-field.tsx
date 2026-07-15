import type { ChangeEvent } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

interface PasswordFieldProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  showPassword: boolean;
  onToggleVisibility: () => void;
  error?: string;
  required?: boolean;
}

export function PasswordField({
  label,
  placeholder,
  value,
  onChange,
  showPassword,
  onToggleVisibility,
  error,
  required = false,
}: PasswordFieldProps) {
  const errorId = error ? `${label.toLowerCase().replace(/\s+/g, "-")}-error` : undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={`auth-${label.toLowerCase().replace(/\s+/g, "-")}`} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
        </span>
        <input
          id={`auth-${label.toLowerCase().replace(/\s+/g, "-")}`}
          type={showPassword ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          aria-invalid={!!error}
          aria-describedby={errorId}
          autoComplete={label.toLowerCase().includes("confirm") ? "new-password" : "current-password"}
          className={`h-11 w-full rounded-xl border ${error ? "border-danger" : "border-input"} bg-background pl-10 pr-10 text-sm text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10`}
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? (
        <p id={errorId} className="text-xs text-danger" role="alert">{error}</p>
      ) : null}
    </div>
  );
}

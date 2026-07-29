import { ReactNode, ButtonHTMLAttributes } from "react";

interface AccessibleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
}

export function AccessibleButton({
  children,
  loading = false,
  loadingLabel = "Loading, please wait",
  disabled,
  ...props
}: AccessibleButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading}
      aria-disabled={disabled || loading}
    >
      {loading && (
        <span aria-live="polite" className="visually-hidden">
          {loadingLabel}
        </span>
      )}
      {children}
    </button>
  );
}

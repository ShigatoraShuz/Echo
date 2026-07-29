import { ReactNode } from "react";

interface ToastProps {
  children: ReactNode;
  type?: "success" | "error" | "info";
  onDismiss?: () => void;
}

const typeLabels = {
  success: "Success notification",
  error: "Error notification",
  info: "Information notification",
};

export function Toast({ children, type = "info", onDismiss }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={typeLabels[type]}
      style={{
        padding: "12px 16px",
        borderRadius: "8px",
        background: type === "success" ? "var(--color-semantic-success)" : type === "error" ? "var(--color-semantic-error)" : "var(--color-semantic-info)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span>{children}</span>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss notification" style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}>
          &times;
        </button>
      )}
    </div>
  );
}

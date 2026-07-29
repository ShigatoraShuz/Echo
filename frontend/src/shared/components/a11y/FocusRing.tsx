import { ReactNode } from "react";

interface FocusRingProps {
  children: ReactNode;
  color?: string;
  offset?: number;
}

export function FocusRing({ children, color = "var(--color-primary-500)", offset = 2 }: FocusRingProps) {
  return (
    <div
      style={{
        outline: "none",
        borderRadius: "inherit",
      }}
      className="focus-ring"
      data-focus-color={color}
      data-focus-offset={offset}
    >
      {children}
    </div>
  );
}

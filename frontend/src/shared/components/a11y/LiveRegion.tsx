import { ReactNode } from "react";

interface LiveRegionProps {
  children: ReactNode;
  politeness?: "polite" | "assertive";
  role?: "status" | "alert" | "log";
}

export function LiveRegion({ children, politeness = "polite", role = "status" }: LiveRegionProps) {
  return (
    <div
      role={role}
      aria-live={politeness}
      aria-atomic="true"
      style={{
        position: "absolute",
        width: "1px",
        height: "1px",
        padding: 0,
        margin: "-1px",
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    >
      {children}
    </div>
  );
}

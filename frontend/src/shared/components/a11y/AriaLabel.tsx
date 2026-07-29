import { ReactNode } from "react";
import { VisuallyHidden } from "./VisuallyHidden";

interface AriaLabelProps {
  label: string;
  children: ReactNode;
  as?: "span" | "div";
}

export function AriaLabel({ label, children, as: Tag = "span" }: AriaLabelProps) {
  return (
    <Tag aria-label={label}>
      {children}
    </Tag>
  );
}

export function LabelledBy({ id, children }: { id: string; children: ReactNode }) {
  return <div aria-labelledby={id}>{children}</div>;
}

import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";
import { EchoButton } from "../ui/echo-button";

interface EchoEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EchoEmptyState({ icon, title, description, action, className }: EchoEmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-14 text-center", className)}>
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
        {icon || <Inbox className="h-6 w-6" />}
      </span>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && (
        <EchoButton variant="primary" size="medium" onClick={action.onClick} className="mt-5">
          {action.label}
        </EchoButton>
      )}
    </div>
  );
}

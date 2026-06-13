import { cn } from "@/lib/utils";
import { Info, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

type InlineVariant = "info" | "success" | "warning" | "error";

interface EchoInlineMessageProps {
  variant?: InlineVariant;
  message: string;
  className?: string;
}

const config: Record<InlineVariant, { icon: React.ReactNode; container: string }> = {
  info: { icon: <Info className="h-4 w-4" aria-hidden="true" />, container: "bg-info/10 text-info border-info/20" },
  success: { icon: <CheckCircle className="h-4 w-4" aria-hidden="true" />, container: "bg-success/10 text-success border-success/20" },
  warning: { icon: <AlertTriangle className="h-4 w-4" aria-hidden="true" />, container: "bg-warning/10 text-warning border-warning/20" },
  error: { icon: <XCircle className="h-4 w-4" aria-hidden="true" />, container: "bg-danger/10 text-danger border-danger/20" },
};

export function EchoInlineMessage({ variant = "info", message, className }: EchoInlineMessageProps) {
  const { icon, container } = config[variant];

  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm", container, className)} role={variant === "error" ? "alert" : "status"}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p className="leading-5">{message}</p>
    </div>
  );
}

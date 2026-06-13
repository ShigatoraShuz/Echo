import { cn } from "@/lib/utils";

interface EchoLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function EchoLabel({ className, required, children, ...props }: EchoLabelProps) {
  return (
    <label
      className={cn(
        "text-sm font-medium text-foreground",
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
    </label>
  );
}

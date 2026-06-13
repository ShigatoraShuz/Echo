"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface EchoIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: "ghost" | "primary" | "secondary" | "soft";
  size?: "small" | "medium";
}

export const EchoIconButton = forwardRef<HTMLButtonElement, EchoIconButtonProps>(
  ({ label, variant = "ghost", size = "medium", className, ...props }, ref) => {
    const sizeStyles = {
      small: "h-8 w-8 rounded-lg",
      medium: "h-11 w-11 rounded-xl",
    };

    const variantStyles = {
      ghost: "text-foreground hover:bg-muted",
      primary: "bg-primary text-primary-foreground hover:bg-primary/90",
      secondary: "border border-border/70 bg-secondary text-secondary-foreground hover:bg-secondary/80",
      soft: "bg-primary/10 text-primary hover:bg-primary/15",
    };

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "inline-flex items-center justify-center outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:opacity-50",
          sizeStyles[size],
          variantStyles[variant],
          className
        )}
        aria-label={label}
        {...props}
      />
    );
  }
);

EchoIconButton.displayName = "EchoIconButton";

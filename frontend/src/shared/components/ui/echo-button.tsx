"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const variantStyles = {
  primary:
    "bg-primary text-primary-foreground shadow-subtle hover:bg-primary/90 active:bg-primary/80",
  secondary:
    "border border-border/70 bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70",
  outline:
    "border border-border bg-background text-foreground hover:bg-muted active:bg-muted/80",
  ghost:
    "text-foreground hover:bg-muted active:bg-muted/80",
  soft:
    "bg-primary/10 text-primary hover:bg-primary/15 active:bg-primary/20",
  danger:
    "bg-danger text-danger-foreground hover:bg-danger/90 active:bg-danger/80",
  crisis:
    "bg-danger/90 text-danger-foreground hover:bg-danger active:bg-danger/90 ring-1 ring-danger/30",
  link:
    "text-primary underline-offset-4 hover:underline h-auto px-0",
} as const;

const sizeStyles = {
  small: "h-9 px-3 text-xs gap-1.5 rounded-lg",
  medium: "h-11 px-5 text-sm gap-2 rounded-xl",
  large: "h-12 px-6 text-base gap-2 rounded-xl",
  icon: "h-11 w-11 p-0 rounded-xl",
} as const;

interface EchoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  isLoading?: boolean;
  loadingText?: string;
}

export const EchoButton = forwardRef<HTMLButtonElement, EchoButtonProps>(
  (
    {
      variant = "primary",
      size = "medium",
      isLoading = false,
      loadingText,
      className,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-semibold outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:opacity-50",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        disabled={isDisabled}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {loadingText ? <span>{loadingText}</span> : <span className="sr-only">Loading</span>}
            {!loadingText && <span aria-hidden="true" className="invisible">{children}</span>}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

EchoButton.displayName = "EchoButton";

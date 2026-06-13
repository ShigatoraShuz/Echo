import { cn } from "@/lib/utils";

interface EchoSkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
}

export function EchoSkeleton({ className, variant = "text", width, height }: EchoSkeletonProps) {
  const base = "animate-pulse bg-muted motion-reduce:animate-none";

  const variants = {
    text: "h-4 w-full rounded",
    circular: "rounded-full",
    rectangular: "rounded-xl",
  };

  return (
    <div
      className={cn(base, variants[variant], className)}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function EchoSkeletonGroup({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <EchoSkeleton key={i} />
      ))}
    </div>
  );
}

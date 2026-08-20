import { cn } from "@/shared/lib/utils";

export const RadialBackground = () => {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 size-full bg-background",
      )}
      style={{
        background:
          "radial-gradient(125% 125% at 50% 10%, hsl(var(--background)) 36%, hsl(var(--secondary) / 0.82) 72%, hsl(var(--primary) / 0.26) 100%)",
      }}
    />
  );
};

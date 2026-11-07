import { HeartHandshake } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export function AiSupportNotice({ prominent = false, className }: { prominent?: boolean; className?: string }) {
  return (
    <aside aria-label="About AI support" className={cn(
      "flex items-start gap-3 rounded-2xl border border-primary/15 bg-[linear-gradient(125deg,rgba(238,244,234,0.94),rgba(251,249,241,0.94))] text-foreground",
      prominent ? "gap-4 px-5 py-5 text-left shadow-[0_12px_32px_rgba(28,62,45,0.05)] sm:px-6" : "px-3.5 py-3",
      className,
    )}>
      <span className={cn("grid shrink-0 place-items-center rounded-full bg-primary/[.08] text-primary", prominent ? "h-11 w-11" : "h-8 w-8")}>
        <HeartHandshake className={prominent ? "h-5 w-5" : "h-4 w-4"} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className={cn("font-semibold text-primary", prominent ? "font-[family-name:var(--font-echo-display)] text-xl leading-tight sm:text-2xl" : "text-[11px] leading-4")}>{prominent ? "Reflection with AI. Care from people." : "A note about AI support"}</p>
        <p className={cn("mt-1 text-foreground/80", prominent ? "max-w-2xl text-base leading-7 sm:text-lg" : "text-xs leading-5")}>
          ECHO’s AI tools support reflection and do not replace a qualified therapist or mental health professional.
        </p>
      </div>
    </aside>
  );
}

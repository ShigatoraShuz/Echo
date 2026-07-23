"use client";
import { Wind, ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface GroundingCardProps {
  exerciseName?: string;
  duration?: string;
}

export function BuddyGroundingCard({ exerciseName = "Box breathing", duration = "2 min" }: GroundingCardProps) {
  return (
    <div className="rounded-2xl border border-primary/10 bg-primary/[0.03] p-4">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">Grounding suggestion</p>
      <p className="mt-2 text-sm font-semibold text-foreground">Try {exerciseName} &mdash; {duration}</p>
      <p className="mt-1 text-xs text-muted-foreground">A gentle way to return to the present moment when thoughts feel heavy.</p>
      <Link href="/tools/grounding" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80">
        Open grounding tools <ArrowUpRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

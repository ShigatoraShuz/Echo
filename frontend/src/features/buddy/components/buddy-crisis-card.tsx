"use client";
import { ShieldAlert, Phone, ExternalLink } from "lucide-react";
import Link from "next/link";

export function BuddyCrisisCard() {
  return (
    <div className="rounded-2xl border border-danger/20 bg-danger/[0.04] p-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-danger" aria-hidden="true" />
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-danger">Support available now</p>
      </div>
      <p className="mt-2 text-sm font-semibold text-foreground">If you are in immediate danger or need urgent support:</p>
      <ul className="mt-3 space-y-2">
        <li>
          <a href="tel:988" className="flex items-center gap-2 rounded-xl bg-danger/10 p-3 text-sm font-bold text-danger hover:bg-danger/20">
            <Phone className="h-4 w-4" /> Call or text 988
          </a>
        </li>
        <li>
          <a href="https://988lifeline.org/chat/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl bg-danger/10 p-3 text-sm font-bold text-danger hover:bg-danger/20">
            <ExternalLink className="h-4 w-4" /> 988 Lifeline Chat
          </a>
        </li>
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">ECHO is not a crisis monitoring service or emergency response tool.</p>
      <Link href="/crisis" className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-danger hover:text-danger/80">
        Full crisis resources <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}

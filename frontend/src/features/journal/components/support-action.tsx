"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  beginSupportVisit,
  type SupportDestination,
} from "../model/support-journey";

export function SupportAction({
  destination,
  children,
  className = "",
  onChoose,
}: {
  destination: SupportDestination;
  children: ReactNode;
  className?: string;
  onChoose?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const choosing = useRef(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      aria-busy={busy}
      onClick={async () => {
        if (choosing.current) return;
        choosing.current = true;
        setBusy(true);
        try {
          await beginSupportVisit(destination);
        } catch {
          /* Access to support must never depend on browser storage or session lookup. */
        }
        onChoose?.();
        router.push(
          destination === "professional"
            ? "/professional-support"
            : "/tools/grounding",
        );
        choosing.current = false;
        setBusy(false);
      }}
    >
      {children}
    </button>
  );
}

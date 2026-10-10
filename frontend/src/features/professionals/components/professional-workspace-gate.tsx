"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { professionalApi } from "@/services/professionals/professional-api";
import { ProfessionalShell, ProfessionalSkeleton } from "./professional-shell";
import { professionalReturnPath } from "../professional-return-path";

export function ProfessionalWorkspaceGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const check = useCallback(async () => {
    setReady(false);
    setError("");
    try {
      const result = await professionalApi.memberships();
      if (result.mfaRequired || !result.memberships.some((item) => item.accessState === "active")) {
        router.replace(`/professional/access?next=${encodeURIComponent(professionalReturnPath(pathname))}`);
        return;
      }
      setReady(true);
    } catch {
      setError("Professional access could not be checked. Please retry.");
    }
  }, [pathname, router]);

  useEffect(() => { void check(); }, [check]);
  if (ready) return children;
  return (
    <ProfessionalShell>
      {error ? (
        <p role="alert" className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm">
          {error} <button type="button" className="font-semibold underline" onClick={() => void check()}>Retry</button>
        </p>
      ) : <ProfessionalSkeleton title="Checking professional access" />}
    </ProfessionalShell>
  );
}

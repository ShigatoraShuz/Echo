"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { JournalSubmissionResponse } from "@echo/contracts";

const AnalysisStatusExperience = dynamic(
  () => import("./analysis-status-experience").then((module) => module.AnalysisStatusExperience),
  { ssr: false },
);

export function AnalysisStatusGateway() {
  const pathname = usePathname();
  const [opened, setOpened] = useState<{ path: string; submission: JournalSubmissionResponse } | null>(null);

  useEffect(() => {
    setOpened(null);
    const clear = () => setOpened(null);
    const onSubmitted = (event: Event) => {
      // Saved progress belongs to its journal. Never replay it on startup/navigation,
      // or open a global overlay for submissions already shown in the inline workspace.
      if (pathname === "/dashboard" || pathname === "/deletion" || pathname.startsWith("/journal")) return;
      setOpened({ path: pathname, submission: (event as CustomEvent<JournalSubmissionResponse>).detail });
    };
    window.addEventListener("echo:analysis-submitted", onSubmitted);
    window.addEventListener("echo:sensitive-state-cleared", clear);
    return () => {
      window.removeEventListener("echo:analysis-submitted", onSubmitted);
      window.removeEventListener("echo:sensitive-state-cleared", clear);
    };
  }, [pathname]);

  return opened?.path === pathname && pathname !== "/dashboard" && pathname !== "/deletion" && !pathname.startsWith("/journal")
    ? <AnalysisStatusExperience initialSubmission={opened.submission} />
    : null;
}

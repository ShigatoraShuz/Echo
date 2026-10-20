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
  const [active, setActive] = useState(false);
  const [initialSubmission, setInitialSubmission] = useState<JournalSubmissionResponse | null>(null);

  useEffect(() => {
    if (pathname === "/deletion") return;
    try {
      setActive(Boolean(localStorage.getItem("echo:active-analysis")));
    } catch {
      // A new submission event can still open the experience without storage.
    }

    const onSubmitted = (event: Event) => {
      setInitialSubmission((event as CustomEvent<JournalSubmissionResponse>).detail);
      setActive(true);
    };
    window.addEventListener("echo:analysis-submitted", onSubmitted);
    return () => window.removeEventListener("echo:analysis-submitted", onSubmitted);
  }, [pathname]);

  return active && pathname !== "/deletion" ? <AnalysisStatusExperience initialSubmission={initialSubmission} /> : null;
}

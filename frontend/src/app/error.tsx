"use client";

import { useEffect } from "react";
import { ErrorState } from "@/shared/components/legacy";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error(
        `[GlobalError] code=${error.name} digest=${error.digest ?? "unknown"}`
      );
    }
  }, [error]);

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <ErrorState
          title="Something went wrong"
          description="Your private sample UI can be reloaded. ECHO is not a diagnostic tool."
        />
        <button type="button" onClick={reset} className="echo-button-primary">
          Try again
        </button>
      </div>
    </main>
  );
}

"use client";

import type { ReactNode } from "react";
import { EchoSidebar } from "../navigation/echo-sidebar";

export function EchoAppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>
      <div className="mx-auto grid min-w-0 max-w-[1440px] grid-cols-1 lg:grid-cols-[280px_1fr]">
        <EchoSidebar />
        <main id="main-content" className="min-w-0 min-h-screen border-l border-border/70 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto min-w-0 max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { EchoPublicNavbar } from "../navigation/echo-public-navbar";
import { EchoPublicFooter } from "../navigation/echo-public-footer";

export function EchoPublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>
      <EchoPublicNavbar />
      <main id="main-content">{children}</main>
      <EchoPublicFooter />
    </div>
  );
}

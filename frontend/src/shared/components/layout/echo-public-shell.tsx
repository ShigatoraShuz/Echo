import type { ReactNode } from "react";
import { EchoPublicNavbar } from "../navigation/echo-public-navbar";
import { EchoPublicFooter } from "../navigation/echo-public-footer";

interface EchoPublicShellProps {
  children: ReactNode;
}

export function EchoPublicShell({ children }: EchoPublicShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <EchoPublicNavbar />
      {children}
      <EchoPublicFooter />
    </div>
  );
}

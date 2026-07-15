import type { ReactNode } from "react";
import { AuthShell } from "@/components/echo/shells";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}

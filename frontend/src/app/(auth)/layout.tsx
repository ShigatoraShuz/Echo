import type { ReactNode } from "react";
import { AuthShell } from "@/shared/components/layout/echo-shells";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}

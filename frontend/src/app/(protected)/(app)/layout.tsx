import type { ReactNode } from "react";
import { AppShell } from "@/shared/components/layout/echo-shells";

export default function CoreAppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

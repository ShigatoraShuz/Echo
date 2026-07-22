import type { ReactNode } from "react";
import { PublicShell } from "@/shared/components/layout/echo-shells";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}

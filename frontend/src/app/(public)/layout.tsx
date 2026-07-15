import type { ReactNode } from "react";
import { PublicShell } from "@/components/echo/shells";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}

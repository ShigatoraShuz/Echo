import { BuddyWellbeingInvitation } from "@/features/buddy/components/buddy-wellbeing-invitation";
import type { ReactNode } from "react";
import { AppShell } from "@/shared/components/layout/app-shell";

export default function CoreAppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}<BuddyWellbeingInvitation /></AppShell>;
}

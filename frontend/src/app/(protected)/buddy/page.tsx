import { BuddyView } from "@/features/buddy";
import { AppShell } from "@/shared/components/layout/echo-shells";

export default function BuddyPage() {
  return (
    <AppShell>
      <BuddyView />
    </AppShell>
  );
}
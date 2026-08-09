import { BuddyHistoryView } from "@/features/buddy";
import { AppShell } from "@/shared/components/layout/echo-shells";

export default function BuddyHistoryPage() {
  return (
    <AppShell>
      <BuddyHistoryView />
    </AppShell>
  );
}
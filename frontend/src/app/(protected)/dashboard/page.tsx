import { AppShell } from "@/shared/components/layout/echo-shells";
import { DashboardView } from "@/features/dashboard/view/dashboard-view";

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardView />
    </AppShell>
  );
}

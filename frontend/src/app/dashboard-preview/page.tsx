import { notFound } from "next/navigation";
import { DashboardView } from "@/features/dashboard/view/dashboard-view";
import { AppShell } from "@/shared/components/layout/echo-shells";

export default function DashboardPreviewPage() {
  if (process.env.NODE_ENV !== "development" || process.env.NEXT_PUBLIC_ENABLE_ANALYSIS_PREVIEW !== "true") notFound();

  return (
    <AppShell preview>
      <DashboardView preview />
    </AppShell>
  );
}

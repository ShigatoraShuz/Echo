// Local production-React measurements only. Never part of the Next route tree.
import { createRoot } from "react-dom/client";
import { useDashboardViewModel } from "../../src/features/dashboard/view-model/use-dashboard-view-model";
import { CalendarView } from "../../src/features/calendar/view/calendar-view";
import { NotificationBell } from "../../src/shared/components/navigation/notification-bell";
import { ThemeProvider } from "../../src/shared/theme/theme-provider";
import { createApiClient } from "../../src/infrastructure/api/api-client";
import type { DashboardService } from "../../src/services/dashboard/dashboard.service";
import { rpc } from "./services";
import "../../src/app/globals.css";

const dashboard: DashboardService = { getDashboardData: range => rpc("dashboard", [range]) };
function DashboardProbe() {
  const vm = useDashboardViewModel("7d", dashboard);
  return <main><h1>Synthetic dashboard lifecycle probe</h1><button onClick={() => vm.setTimeRange("30d")}>Change range</button><output data-ready={!vm.isLoading && !!vm.data}>{vm.data?.userProfile.name}</output></main>;
}
// Expose only a synthetic same-origin request probe, never application data.
const client = createApiClient({ baseUrl: window.location.origin });
Object.assign(window, { auditRequests: async () => {
  const controller = new AbortController();
  await Promise.all(Array.from({ length: 100 }, () => client.get("/__api-probe", { signal: controller.signal })));
} });
const path = window.location.pathname;
createRoot(document.getElementById("root")!).render(<ThemeProvider>{path === "/calendar" ? <CalendarView /> : path === "/__qa/user-notifications" ? <NotificationBell /> : <DashboardProbe />}</ThemeProvider>);

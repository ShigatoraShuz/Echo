import { ProfessionalCredentialReview } from "@/features/professionals/components/professional-credential-review";
import { ThemeProvider } from "@/shared/theme/theme-provider";
import { ProfessionalSettingsView } from "@/features/professionals/view/professional-settings-view";
import { Profiler } from "react";
import { NotificationBell } from "@/shared/components/navigation/notification-bell";
import { ProfessionalMessagesView } from "@/features/professionals/view/professional-messages-view";
import { createRoot } from "react-dom/client";
import "../../src/app/globals.css";
import { usePathname } from "./next";
import { ProfessionalLoginView } from "@/features/professionals/view/professional-login-view";
import { ProfessionalAccessView } from "@/features/professionals/view/professional-access-view";
import { ProfessionalDashboard } from "@/features/professionals/view/professional-dashboard";
import { ProfessionalCalendarView } from "@/features/professionals/view/professional-calendar-view";
import { ProfessionalResourcesView } from "@/features/professionals/view/professional-resources-view";
import { ProfessionalRequestsView, ProfessionalMyCasesView } from "@/features/professionals/view/professional-requests-view";
import { ProfessionalCaseView } from "@/features/professionals/view/professional-case-view";
import { ProfessionalWorkspaceGate } from "@/features/professionals/components/professional-workspace-gate";
import { ProfessionalClinicianPreview } from "@/features/professionals/dev/professional-clinician-preview";
import { ProfessionalPreview } from "@/features/professionals/dev/professional-preview";

function Harness() {
  const path = usePathname();
  if (path === "/__qa/user-notifications" || path === "/settings/verification") return <ThemeProvider><div className="min-h-screen bg-background text-foreground"><header className="flex items-center justify-between border-b border-border bg-card px-6 py-4"><a href="/__qa/user-notifications" className="font-serif text-2xl text-primary">Echo</a><NotificationBell /></header><main className="mx-auto max-w-5xl p-8"><p className="text-xs font-semibold uppercase tracking-widest text-primary">Fictional browser fixture</p><h1 className="mt-4 font-serif text-4xl">A little space for you.</h1><p className="mt-4 max-w-lg text-muted-foreground">Your private reflections, helpful tools and support - at your pace.</p></main></div></ThemeProvider>;
  if (path === "/professional-support/messages") return <ThemeProvider><ProfessionalMessagesView /></ThemeProvider>;
  if (path === "/professional/login") return <ProfessionalLoginView />;
  if (path === "/__qa/professional-review") return <ProfessionalCredentialReview organizationId="org-one" organizationName="Fictional organization" active onChanged={() => undefined} />;
  if (path === "/professional/access") return <ProfessionalAccessView />;
  if (path === "/dev/professional-preview") return <ProfessionalClinicianPreview />;
  if (path === "/synthetic-preview") return <ProfessionalPreview />;
  const content = path.includes("/cases/") ? <ProfessionalCaseView id={path.split("/").at(-1)!} /> : path === "/professional/requests" ? <ProfessionalRequestsView /> : path === "/professional/my-cases" ? <ProfessionalMyCasesView /> : path === "/professional/calendar" ? <ProfessionalCalendarView /> : path === "/professional/settings" ? <ThemeProvider><ProfessionalSettingsView /></ThemeProvider> : path === "/professional/resources" ? <ProfessionalResourcesView /> : <ProfessionalDashboard />;
  return <ProfessionalWorkspaceGate>{content}</ProfessionalWorkspaceGate>;
}
// Optional local profiling records timings only; never component props or case data.
createRoot(document.getElementById("root")!).render(<Profiler id="professional" onRender={(_id, phase, actualDuration, _baseDuration, _startTime, commitTime) => {
  const target = window as Window & { __professionalProfile?: Array<{ phase: string; actualDuration: number; commitTime: number }> };
  target.__professionalProfile?.push({ phase, actualDuration, commitTime });
}}><Harness /></Profiler>);

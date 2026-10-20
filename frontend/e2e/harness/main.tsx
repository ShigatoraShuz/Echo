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
import { ProfessionalPreview } from "@/features/professionals/dev/professional-preview";

function Harness() {
  const path = usePathname();
  if (path === "/professional/login") return <ProfessionalLoginView />;
  if (path === "/professional/access") return <ProfessionalAccessView />;
  if (path === "/synthetic-preview") return <ProfessionalPreview />;
  const content = path.includes("/cases/") ? <ProfessionalCaseView id={path.split("/").at(-1)!} /> : path === "/professional/requests" ? <ProfessionalRequestsView /> : path === "/professional/my-cases" ? <ProfessionalMyCasesView /> : path === "/professional/calendar" ? <ProfessionalCalendarView /> : path === "/professional/resources" ? <ProfessionalResourcesView /> : <ProfessionalDashboard />;
  return <ProfessionalWorkspaceGate>{content}</ProfessionalWorkspaceGate>;
}
createRoot(document.getElementById("root")!).render(<Harness />);

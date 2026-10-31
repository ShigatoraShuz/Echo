import { ProfessionalWorkspaceGate } from "@/features/professionals/components/professional-workspace-gate";
import { ProfessionalCalendarView } from "@/features/professionals/view/professional-calendar-view";

export const metadata = { title: "Professional calendar — ECHO" };
export default function ProfessionalCalendarPage() {
  return <ProfessionalWorkspaceGate><ProfessionalCalendarView /></ProfessionalWorkspaceGate>;
}

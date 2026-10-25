import { ProfessionalWorkspaceGate } from "@/features/professionals/components/professional-workspace-gate";
import { ProfessionalSettingsView } from "@/features/professionals/view/professional-settings-view";

export default function ProfessionalSettingsPage() {
  return <ProfessionalWorkspaceGate><ProfessionalSettingsView /></ProfessionalWorkspaceGate>;
}

import { ProfessionalCaseView } from "@/features/professionals/view/professional-case-view";
import { ProfessionalWorkspaceGate } from "@/features/professionals/components/professional-workspace-gate";

export default async function ProfessionalCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProfessionalWorkspaceGate><ProfessionalCaseView id={id} /></ProfessionalWorkspaceGate>;
}

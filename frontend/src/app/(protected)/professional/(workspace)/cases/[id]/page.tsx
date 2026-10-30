import { ProfessionalCaseView } from "@/features/professionals/view/professional-case-view";

export default async function ProfessionalCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProfessionalCaseView id={id} />;
}

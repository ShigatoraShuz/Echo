import { MyRequestDetailView } from "@/features/professionals/view/my-requests-view";

export default async function ProfessionalRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MyRequestDetailView id={id} />;
}

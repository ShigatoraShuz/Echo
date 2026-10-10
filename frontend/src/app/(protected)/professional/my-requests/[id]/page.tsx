import { MyRequestDetailView } from "@/features/professionals/view/my-requests-view";

export default async function MyRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MyRequestDetailView id={id} />;
}

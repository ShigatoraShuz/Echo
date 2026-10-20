import { JournalDetailView } from "@/features/journal/view/journal-detail-view";

export default async function JournalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <JournalDetailView id={id} />
  );
}

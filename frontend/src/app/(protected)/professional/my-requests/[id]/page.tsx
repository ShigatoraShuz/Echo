import { redirect } from "next/navigation";

export default async function MyRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/professional-support/requests/${encodeURIComponent(id)}`);
}

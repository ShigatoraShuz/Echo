import { Suspense } from "react";
import { SupportRequestView } from "@/features/professionals/view/support-request-view";

export default function NewProfessionalRequestPage() {
  return <Suspense fallback={null}><SupportRequestView /></Suspense>;
}

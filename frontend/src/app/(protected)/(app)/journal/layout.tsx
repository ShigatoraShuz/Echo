import type { ReactNode } from "react";
import { JournalSupportJourney } from "@/features/journal/components/journal-support-journey";

export default function JournalSupportLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <JournalSupportJourney>{children}</JournalSupportJourney>;
}

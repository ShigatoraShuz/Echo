import type { Metadata } from "next";

import { LandingView, LANDING_PAGE_METADATA } from "@/features/landing";

export const metadata: Metadata = LANDING_PAGE_METADATA;

export default function HomePage() {
  return <LandingView />;
}

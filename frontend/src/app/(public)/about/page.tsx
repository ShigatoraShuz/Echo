import type { Metadata } from "next";
import { AboutPageView } from "@/features/public-content";

export const metadata: Metadata = {
  title: "About | ECHO",
  description: "Learn how ECHO makes private reflection, thoughtful prompts, and optional insights feel gentler.",
};

export default function AboutPage() {
  return <AboutPageView />;
}

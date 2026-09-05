import type { Metadata } from "next";
import { PrivacyPolicyView } from "@/features/public-content";

export const metadata: Metadata = {
  title: "Privacy policy | ECHO",
  description: "A plain-language guide to how ECHO collects, protects, and gives you control over your information.",
};

export default function PrivacyPolicyPage() {
  return <PrivacyPolicyView />;
}

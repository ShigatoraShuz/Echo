import { PrivacyNotice } from "@/shared/components/echo/privacy-notice";

export function AuthPrivacyNote({ compact }: { compact?: boolean }) {
  return <PrivacyNotice compact={compact} />;
}

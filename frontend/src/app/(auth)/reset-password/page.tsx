import { ResetPasswordView } from "@/features/authentication/view/reset-password-view";

export const metadata = { title: "Choose a new password — ECHO" };

export default function ResetPasswordPage() {
  return (
    <ResetPasswordView
      title="Choose a new password"
      description="Create a secure password for your private ECHO workspace."
    />
  );
}

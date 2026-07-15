import { ForgotPasswordView } from "@/features/authentication/view/forgot-password-view";

export const metadata = { title: "Reset password — ECHO" };

export default function ForgotPasswordPage() {
  return (
    <ForgotPasswordView
      title="Reset your password"
      description="Enter your email and ECHO will send a private reset link when backend email is connected."
    />
  );
}

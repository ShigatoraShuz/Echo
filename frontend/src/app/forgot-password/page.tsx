import { AuthPage } from "@/components/echo/public-pages";

export default function ForgotPasswordPage() {
  return (
    <AuthPage
      mode="forgot"
      title="Reset your password"
      description="Enter your email and ECHO will send a private reset link when backend email is connected."
    />
  );
}

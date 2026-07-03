import { AuthPage } from "@/components/echo/public-pages";

export default function ResetPasswordPage() {
  return (
    <AuthPage
      mode="reset"
      title="Choose a new password"
      description="Create a secure password for your private ECHO workspace."
    />
  );
}

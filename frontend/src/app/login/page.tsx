import { AuthPage } from "@/components/echo/public-pages";

export default function LoginPage() {
  return (
    <AuthPage
      mode="login"
      title="Welcome back"
      description="Return to your private journal, Buddy conversations, and calm check-in tools."
    />
  );
}

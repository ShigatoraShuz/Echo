import { LoginView } from "@/features/authentication/view/login-view";

export const metadata = { title: "Log in — ECHO" };

export default function LoginPage() {
  return (
    <LoginView
      title="Welcome back"
      description="Return to your private journal, Buddy conversations, and calm check-in tools."
    />
  );
}

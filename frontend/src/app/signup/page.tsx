import { AuthPage } from "@/components/echo/public-pages";

export default function SignupPage() {
  return (
    <AuthPage
      mode="signup"
      title="Create a private ECHO space"
      description="Set up reflective journaling, Buddy support, and safety-aware wellbeing summaries. ECHO is not a diagnostic tool."
    />
  );
}

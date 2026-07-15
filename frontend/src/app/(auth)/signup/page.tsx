import { SignupView } from "@/features/authentication/view/signup-view";

export const metadata = { title: "Create account — ECHO" };

export default function SignupPage() {
  return (
    <SignupView
      title="Create a private ECHO space"
      description="Set up reflective journaling, Buddy support, and safety-aware wellbeing summaries. ECHO is not a diagnostic tool."
    />
  );
}

import { AdminLoginView } from "@/features/authentication/view/admin-login-view";

export const metadata = {
  title: "Admin sign in — ECHO",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return <AdminLoginView />;
}

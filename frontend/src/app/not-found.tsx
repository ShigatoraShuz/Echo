import Link from "next/link";
import { EmptyState } from "@/shared/components/legacy";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6">
      <div className="mx-auto max-w-2xl">
        <EmptyState
          title="Page not found"
          description="This ECHO route is not available yet. ECHO is not a diagnostic tool."
        />
        <div className="mt-5 flex justify-center">
          <Link href="/dashboard" className="echo-button-primary">
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

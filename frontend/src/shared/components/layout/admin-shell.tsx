"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Leaf, LogOut } from "lucide-react";
import { getAuthService } from "@/services/authentication/auth-service.factory";

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  async function logOut() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      const result = await getAuthService().logout();
      if (!result.success) {
        setLogoutError(result.error.message || "Could not log out. Please try again.");
        return;
      }
      router.replace("/admin-login");
      router.refresh();
    } catch {
      setLogoutError("Could not log out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fcfaf6] text-foreground">
      <header className="border-b border-border/70 bg-card/95">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin/verifications" className="mr-auto inline-flex items-center gap-3 font-bold text-primary">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Leaf className="size-5" aria-hidden="true" /></span>
            <span>ECHO <span className="font-medium text-muted-foreground">Admin</span></span>
          </Link>
          <nav aria-label="Admin navigation" className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <Link href="/admin/verifications" className="rounded-xl px-3 py-2 text-primary hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Verification reviews</Link>
            <Link href="/admin/professionals" className="rounded-xl px-3 py-2 text-primary hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Professional access</Link>
            <Link href="/settings/profile" className="rounded-xl px-3 py-2 text-muted-foreground hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">My account</Link>
            <button type="button" disabled={loggingOut} onClick={() => void logOut()} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-muted-foreground hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">
              <LogOut className="size-4" aria-hidden="true" /> {loggingOut ? "Logging out…" : "Log out"}
            </button>
          </nav>
        </div>
      </header>
      {logoutError && <p role="alert" className="mx-auto max-w-[1500px] px-4 pt-3 text-sm text-danger sm:px-6">{logoutError}</p>}
      <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:py-8">
        {children}
      </main>
    </div>
  );
}

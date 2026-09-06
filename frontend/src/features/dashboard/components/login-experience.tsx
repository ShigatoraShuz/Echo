"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { EchoDialog } from "@/shared/components/ui/echo-dialog";
import { Phq8CheckIn } from "./phq8-check-in";
import { assessmentService } from "@/services/assessment/assessment.service";
import { getAuthService } from "@/services/authentication/auth-service.factory";
const welcomedSessions = new Set<string>();
export function LoginExperience({ sessionKey }: { sessionKey: string }) {
  const router = useRouter(),
    pathname = usePathname();
  const [step, setStep] = useState<"loading" | "welcome" | "assessment" | "intro" | "done" | "error">("loading");
  const [dashboardReady, setDashboardReady] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  useEffect(() => {
    const initialized = () => setDashboardReady(true);
    window.addEventListener("echo:dashboard-ready", initialized);
    if (document.querySelector("[data-echo-dashboard-ready]")) initialized();
    return () => window.removeEventListener("echo:dashboard-ready", initialized);
  }, []);
  const due = useRef(false),
    welcome = useRef(false);
  const key = "echo-login:" + sessionKey;
  const check = useCallback(async () => {
    try {
      const status = await assessmentService.status();
      due.current = status.due;
      welcome.current = welcomedSessions.has(key);
      try {
        welcome.current ||= sessionStorage.getItem(key) === "welcomed";
      } catch {}
      setStep(welcome.current ? (status.due ? "assessment" : "done") : "welcome");
    } catch {
      setStep("error");
    }
  }, [key]);
  useEffect(() => {
    void check();
  }, [check]);
  useEffect(() => {
    if (pathname !== "/dashboard" && ["welcome", "assessment"].includes(step)) router.replace("/dashboard");
  }, [pathname, step, router]);
  async function logout() {
    setLogoutError(false);
    try {
      const result = await getAuthService().logout();
      if (result.success) {
        router.replace("/login");
        router.refresh();
      } else setLogoutError(true);
    } catch {
      setLogoutError(true);
    }
  }
  function afterWelcome() {
    welcomedSessions.add(key);
    try {
      sessionStorage.setItem(key, "welcomed");
    } catch {}
    setStep(due.current ? "assessment" : "intro");
  }
  const completed = () => {
    due.current = false;
    setStep("intro");
    window.dispatchEvent(new Event("echo:assessment-saved"));
    router.refresh();
  };
  if (step === "done") return null;
  return (
    <EchoDialog
      open={step !== "welcome" || dashboardReady}
      onClose={() => {
        if (step === "intro") setStep("done");
      }}
      dismissible={step === "intro"}
      size={step === "assessment" ? "large" : "medium"}
      title={
        step === "welcome"
          ? "Welcome to your ECHO space"
          : step === "assessment"
            ? "A moment to check in"
            : step === "intro"
              ? "Room for another perspective"
              : step === "error"
                ? "We could not load your check-in"
                : "Preparing your space"
      }
    >
      {step === "welcome" && (
        <div className="space-y-4">
          <p>There is no perfect way to arrive. Take a breath, settle in, and give yourself a little room today.</p>
          <button className="echo-button-primary" onClick={afterWelcome}>
            Continue
          </button>
        </div>
      )}
      {step === "assessment" && (
        <>
          <p className="mb-4 text-sm">
            Your check-in is due. Complete all eight questions to continue into ECHO. Support and logout remain
            available below.
          </p>
          <Phq8CheckIn onCompleted={completed} />
        </>
      )}
      {step === "intro" && (
        <div className="space-y-4 text-sm">
          <p>Want ECHO to help you reflect on your recent journal?</p>
          <p>
            AI analysis is optional and is not a diagnosis. You choose whether to allow analysis of each journal, and
            active journal consent is required. Your private images are not analyzed. The model may temporarily be
            unavailable; your journal stays saved.
          </p>
          <p>Complete verification and add a Trusted Support Contact before using AI Analysis or Buddy.</p>
          <Link onClick={() => setStep("done")} href="/journal" className="echo-button-primary">
            Choose a journal
          </Link>
          <button onClick={() => setStep("done")} className="echo-button-secondary">
            Not now
          </button>
        </div>
      )}
      {step === "loading" && <p role="status">Checking your saved assessment…</p>}
      {step === "error" && (
        <div role="alert">
          <p>Your assessment status is unavailable. Please retry.</p>
          <button onClick={() => void check()} className="echo-button-primary mt-3">
            Retry
          </button>
        </div>
      )}
      {logoutError && <p role="alert">Logout could not complete. Please retry.</p>}
      <nav aria-label="Always available support" className="mt-6 flex flex-wrap gap-4 border-t pt-4 text-sm">
        <Link href="/crisis" className="underline">
          Crisis resources and emergency numbers
        </Link>
        <button onClick={() => void logout()} className="underline">
          Log out
        </button>
      </nav>
    </EchoDialog>
  );
}

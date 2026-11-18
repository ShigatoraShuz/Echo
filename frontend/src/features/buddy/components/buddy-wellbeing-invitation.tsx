"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bot, X } from "lucide-react";
import { useNotificationSound } from "@/shared/hooks/use-notification-sound";
import { requestBuddyInvitation } from "@/services/settings/account-activity";
import styles from "./buddy-wellbeing-invitation.module.css";
export function BuddyWellbeingInvitation() {
  const pathname = usePathname();
  const { actor } = useNotificationSound();
  const [shownFor, setShownFor] = useState("");
  useEffect(() => {
    const reset = (event: StorageEvent) => {
      if (event.key !== "echo:activity-reset" || !event.newValue) return;
      try {
        if (JSON.parse(event.newValue).actor === actor) window.location.assign("/dashboard?reset=complete");
      } catch {}
    };
    window.addEventListener("storage", reset);
    return () => window.removeEventListener("storage", reset);
  }, [actor]);
  const allowed = ["/dashboard", "/insights", "/calendar"].includes(pathname);
  useEffect(() => {
    setShownFor("");
    if (!actor || !allowed) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "hidden") return;
      void requestBuddyInvitation()
        .then((show) => {
          if (active && show) setShownFor(actor);
        })
        .catch(() => {});
    }, 8000);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [actor, allowed, pathname]);
  if (!actor || shownFor !== actor || !allowed) return null;
  return <BuddyInvitationCard onDismiss={() => setShownFor("")} />;
}

export function BuddyInvitationCard({ onDismiss }: { onDismiss: () => void }) {
  const dismiss = onDismiss;
  return (
    <aside role="region" aria-label="A gentle invitation from Buddy" className={styles.card}>
      <div className="flex items-start gap-3">
        <span className={styles.avatar}>
          <Bot size={24} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={styles.eyebrow}>A moment for yourself</p>
          <h2 className="mt-1 font-serif text-xl">Hi, I'm Buddy.</h2>
        </div>
        <button
          type="button"
          aria-label="Dismiss Buddy invitation"
          onClick={dismiss}
          className="grid min-h-11 min-w-11 place-items-center rounded-full hover:bg-secondary"
        >
          <X size={17} />
        </button>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        If things have felt heavy lately, you can talk with me or take a gentle pause with grounding. Choose what feels
        right for you.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/buddy"
          onClick={dismiss}
          className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Talk with Buddy
        </Link>
        <Link
          href="/tools/grounding"
          onClick={dismiss}
          className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold text-primary"
        >
          Try grounding
        </Link>
      </div>
    </aside>
  );
}

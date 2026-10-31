"use client";
import { useEffect, useState } from "react";
import { useNotificationSound } from "@/shared/hooks/use-notification-sound";
import {
  enableNotificationSound,
  soundEnabled,
  testNotificationSound,
} from "@/services/notifications/notification-sound";
export function NotificationSoundControls({ userId }: { userId?: string }) {
  const { actor } = useNotificationSound(userId);
  const [enabled, setEnabled] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    setEnabled(soundEnabled(actor));
    setMessage("");
  }, [actor]);
  return (
    <div className="my-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            disabled={!actor}
            checked={enabled}
            onChange={(event) => {
              const next = event.target.checked;
              setEnabled(next);
              void enableNotificationSound(actor, next).then((ok) =>
                setMessage(
                  ok
                    ? "Sound preference saved on this device."
                    : "Audio unavailable. Visual notifications remain enabled.",
                ),
              );
            }}
          />
          Notification sounds
        </label>
        <button
          type="button"
          disabled={!actor}
          className="echo-focus-ring min-h-11 rounded-xl border border-border px-4 text-xs font-semibold text-primary"
          onClick={() =>
            void testNotificationSound(actor).then((ok) =>
              setMessage(ok ? "Test sound played." : "Audio unavailable. Visual notifications remain enabled."),
            )
          }
        >
          Play test sound
        </button>
      </div>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">
        Off by default. A soft chime for new updates while this tab is visible. Quiet hours and in-app notification
        settings apply. After reopening the browser, use this control to enable audio for the session.
      </p>
      {message ? (
        <p role="status" className="mt-2 text-xs">
          {message}
        </p>
      ) : null}
    </div>
  );
}

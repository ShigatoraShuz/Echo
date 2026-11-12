"use client";

import { useState } from "react";
import { notificationsService } from "@/services/notifications";
import type { DailyDistressRating as Rating } from "@/services/notifications/notifications.service";

const ratings = ["low", "moderate", "high"] as const;

export function DailyDistressCheckin() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [rating, setRating] = useState<Rating | null>(null);
  const [saved, setSaved] = useState<Rating | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setBusy(true);
    setError("");
    try {
      const data = await notificationsService.getDailyDistress();
      setRating(data.rating);
      setSaved(data.rating);
      setLoaded(true);
    } catch {
      setError("Your check-in could not be loaded. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!rating || busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await notificationsService.saveDailyDistress(rating);
      setSaved(data.rating);
      window.dispatchEvent(new Event("echo:notifications-changed"));
    } catch {
      setError("Your check-in could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[1.75rem] border border-primary/15 bg-card p-5 shadow-sm" aria-labelledby="daily-distress-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="daily-distress-title" className="font-semibold">Daily distress check-in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Optional · How heavy does today feel?</p>
        </div>
        <button type="button" className="echo-button-secondary" aria-expanded={open} aria-controls="daily-distress-form"
          onClick={() => { setOpen(!open); if (!open && !busy) void load(); }}>
          {open ? "Close check-in" : "Check in"}
        </button>
      </div>
      {open && <div id="daily-distress-form" className="mt-4" aria-busy={busy}>
        <p className="max-w-prose text-sm leading-6 text-muted-foreground">
          Your answer is private. If you report high distress for three days in a row and your saved journal analyses pick up difficult emotions on those days, Echo may suggest a reflection or a chat with Buddy in your notifications.
        </p>
        {loaded && <form className="mt-4 space-y-3" onSubmit={event => { event.preventDefault(); void save(); }}>
          <fieldset disabled={busy} className="flex flex-wrap gap-2">
            <legend className="sr-only">How distressed do you feel today?</legend>
            {ratings.map(value => <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-primary/20 px-4 text-sm capitalize">
              <input type="radio" name="daily-distress-rating" checked={rating === value} onChange={() => setRating(value)} />
              {value}
            </label>)}
          </fieldset>
          <button type="submit" className="echo-button-secondary" disabled={busy || !rating || rating === saved}>Save check-in</button>
          {saved && <p role="status" className="text-sm text-muted-foreground">Today’s check-in is saved.</p>}
        </form>}
        {error && <p role="alert" className="mt-3 text-sm text-muted-foreground">{error}{!loaded && <button type="button" className="ml-2 underline" onClick={() => void load()}>Retry</button>}</p>}
      </div>}
    </section>
  );
}

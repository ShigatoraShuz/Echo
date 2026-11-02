"use client";

import { z } from "zod";
import { journalSubmissionResponseSchema } from "@echo/contracts";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";

export const SUPPORT_JOURNEY_KEY = "echo:journal-support-journey:v2";
export type SupportDestination = "professional" | "grounding";
export const supportCheckInSchema = z.object({
  ownerId: z.string().uuid(),
  eligible: z.boolean(),
  recentJournalIds: z.array(z.string().uuid()).max(3),
});
export type SupportCheckIn = z.infer<typeof supportCheckInSchema>;
const recordSchema = z.object({
  ownerId: z.string().uuid(),
  handledJournalIds: z.array(z.string().uuid()).max(3),
  updatedAt: z.number().finite(),
  visit: z
    .object({
      id: z.string().uuid(),
      destination: z.enum(["professional", "grounding"]),
      completed: z.boolean(),
      arrived: z.boolean().default(false),
    })
    .nullable(),
});
type Journey = z.infer<typeof recordSchema>;
let memory: Journey | null = null;
let identityEpoch = 0;
const MAX_AGE = 24 * 60 * 60 * 1000;

export function clearSupportJourney() {
  memory = null;
  try {
    sessionStorage.removeItem(SUPPORT_JOURNEY_KEY);
  } catch {
    /* Memory-only fallback. */
  }
}
if (typeof window !== "undefined")
  window.addEventListener("echo:sensitive-state-cleared", () => {
    ++identityEpoch;
    clearSupportJourney();
  });

function read(): Journey | null {
  let candidate: unknown = memory;
  try {
    if (!candidate) {
      const raw = sessionStorage.getItem(SUPPORT_JOURNEY_KEY);
      if (raw) candidate = JSON.parse(raw);
    }
  } catch {
    /* Storage can be denied. */
  }
  const parsed = recordSchema.safeParse(candidate);
  if (
    !parsed.success ||
    Date.now() - parsed.data.updatedAt > MAX_AGE ||
    parsed.data.updatedAt > Date.now() + 60000
  ) {
    clearSupportJourney();
    return null;
  }
  memory = parsed.data;
  return memory;
}
function write(value: Journey) {
  memory = value;
  try {
    sessionStorage.setItem(SUPPORT_JOURNEY_KEY, JSON.stringify(value));
  } catch {
    /* Choices still work without storage. */
  }
}
function forOwner(ownerId: string): Journey {
  const saved = read();
  if (saved && saved.ownerId === ownerId) return saved;
  clearSupportJourney();
  return { ownerId, handledJournalIds: [], updatedAt: Date.now(), visit: null };
}
export function shouldOfferSupport(state: SupportCheckIn) {
  const saved = forOwner(state.ownerId);
  return (
    state.eligible &&
    new Set(state.recentJournalIds).size === 3 &&
    state.recentJournalIds.length === 3 &&
    !state.recentJournalIds.some((id) => saved.handledJournalIds.includes(id))
  );
}
export function acknowledgeSupportOffer(state: SupportCheckIn) {
  write({
    ...forOwner(state.ownerId),
    handledJournalIds: state.recentJournalIds,
    updatedAt: Date.now(),
  });
}
export async function beginSupportVisit(destination: SupportDestination) {
  // This identity scopes local presentation only. The backend owns all authorization and flags.
  const epoch = identityEpoch;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      createBrowserSupabaseClient().auth.getSession(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 1500);
      }),
    ]);
    if (!result || epoch !== identityEpoch) return;
    const ownerId = result.data.session?.user.id;
    if (!ownerId || !z.string().uuid().safeParse(ownerId).success) return;
    write({
      ...forOwner(ownerId),
      visit: {
        id: crypto.randomUUID(),
        destination,
        completed: false,
        arrived: false,
      },
      updatedAt: Date.now(),
    });
    try {
      const raw = localStorage.getItem("echo:active-analysis");
      const current = journalSubmissionResponseSchema.safeParse(
        raw ? JSON.parse(raw) : null,
      );
      if (current.success)
        localStorage.setItem(
          "echo:active-analysis:visibility",
          `${current.data.analysisJobId}:minimized`,
        );
    } catch {
      /* Navigation remains available. */
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export function supportVisitToken(destination: SupportDestination) {
  const visit = read()?.visit;
  return visit?.destination === destination ? visit.id : null;
}
export function completeSupportVisit(
  destination: SupportDestination,
  visitId: string | null,
) {
  const saved = read();
  if (
    visitId &&
    saved?.visit?.id === visitId &&
    saved.visit.destination === destination
  )
    write({
      ...saved,
      visit: { ...saved.visit, completed: true },
      updatedAt: Date.now(),
    });
}
export function markSupportVisitArrived(destination: SupportDestination) {
  const saved = read();
  if (saved?.visit?.destination === destination)
    write({
      ...saved,
      visit: { ...saved.visit, arrived: true },
      updatedAt: Date.now(),
    });
}
export function getSupportReturn(ownerId: string) {
  const saved = forOwner(ownerId);
  const visit = saved.visit;
  return visit?.arrived
    ? {
        id: visit.id,
        destination: visit.destination,
        completed: visit.completed,
      }
    : null;
}

export function acknowledgeSupportReturn(
  state: SupportCheckIn,
  visitId: string,
) {
  const saved = forOwner(state.ownerId);
  if (!saved.visit?.arrived || saved.visit.id !== visitId) return false;
  write({
    ...saved,
    handledJournalIds: state.recentJournalIds,
    visit: null,
    updatedAt: Date.now(),
  });
  return true;
}

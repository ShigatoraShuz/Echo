export interface SafetySignal {
  kind: "none" | "immediate" | "professional_support";
  eventId?: string;
}
export function shouldShowSupport(signal: SafetySignal, seen: string | null) {
  return signal.kind !== "none" && !!signal.eventId && seen !== signal.eventId;
}

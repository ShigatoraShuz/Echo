type EmotionDay = { date: string; values: Record<string, number>; modelIdentity?: string; isSimulated?: boolean };
const negative = new Set(["sadness", "fear", "anger", "disgust"]);
/** Three recent analyzed days in one week, from the same model. Not a diagnosis. */
export function shouldOfferBuddyInvitation(points: EmotionDay[], now = Date.now()): boolean {
  const families = new Map<string, Map<string, EmotionDay>>();
  for (const point of points) {
    const date = Date.parse(point.date);
    if (point.isSimulated || !Number.isFinite(date) || date > now || now - date > 7 * 86400000) continue;
    const identity = point.modelIdentity ?? "legacy";
    const days = families.get(identity) ?? new Map();
    days.set(point.date, point);
    families.set(identity, days);
  }
  const latestDate = [...families.values()]
    .flatMap((days) => [...days.keys()])
    .sort()
    .at(-1);
  return [...families.values()].some((days) => {
    const recent = [...days.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
    return (
      recent.length === 3 &&
      recent[0].date === latestDate &&
      now - Date.parse(recent[0].date) < 2 * 86400000 &&
      recent.every((day) => {
        const scores = Object.entries(day.values)
          .filter(([, score]) => Number.isFinite(score) && score >= 0 && score <= 1)
          .sort((a, b) => b[1] - a[1]);
        return scores.length > 0 && negative.has(scores[0][0].toLowerCase()) && scores[0][1] >= 0.35;
      })
    );
  });
}

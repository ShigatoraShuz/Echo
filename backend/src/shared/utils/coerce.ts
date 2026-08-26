export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

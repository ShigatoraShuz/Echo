export function parseBooleanStrict(value: string | undefined): boolean | null {
  if (value === undefined) return null;
  const lower = value.trim().toLowerCase();
  if (lower === "true" || lower === "1") return true;
  if (lower === "false" || lower === "0") return false;
  return null;
}

export function isTruthy(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    return lower === "true" || lower === "1";
  }
  if (typeof value === "number") return value !== 0;
  return false;
}

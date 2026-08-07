const sensitiveKeys = new Set([
  "authorization",
  "access_token",
  "refresh_token",
  "password",
  "journal_text",
  "content",
  "body",
  "ai_service_token",
  "supabase_service_role_key",
]);

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
      key,
      sensitiveKeys.has(key.toLowerCase()) ? "[REDACTED]" : redact(nestedValue),
    ])
  );
}

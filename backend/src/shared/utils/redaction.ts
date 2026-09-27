const sensitiveNames = /^(?:authorization|proxyauthorization|cookie|setcookie|password|currentpassword|newpassword|oldpassword|accesstoken|refreshtoken|idtoken|token|secret|apikey|journaltext|journalbody|prompt|messages|content|body|document|documentcontents|aiservicetoken|supabaseservicerolekey|journalencryptionkeybase64)$/;

/** Structured telemetry only. Arbitrary free-text logging is prohibited at callers. */
export function redact(value: unknown): unknown {
  const seen = new WeakSet<object>();
  function visit(item: unknown, depth: number): unknown {
    if (depth > 12) return "[REDACTED]";
    if (typeof item === "string") return item
      .replace(/Bearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED]");
    if (!item || typeof item !== "object") return item;
    if (seen.has(item)) return "[REDACTED]";
    seen.add(item);
    if (Array.isArray(item)) return item.map((entry) => visit(entry, depth + 1));
    return Object.fromEntries(Object.entries(item).map(([key, entry]) => [key,
      sensitiveNames.test(key.toLowerCase().replace(/[^a-z0-9]/g, "")) || /(?:password|secret|token|privatekey|encryptionkey)$/i.test(key.replace(/[^a-z0-9]/gi,""))
        ? "[REDACTED]" : visit(entry, depth + 1)]));
  }
  return visit(value, 0);
}

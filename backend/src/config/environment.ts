import { z } from "zod";

const base64KeySchema = z
  .string()
  .trim()
  .min(1)
  .superRefine((value, context) => {
    const decoded = Buffer.from(value, "base64");
    if (decoded.length !== 32) {
      context.addIssue({ code: "custom", message: "must decode to exactly 32 bytes" });
    }
  });

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4200),
  PHQ8_INTERVAL_DAYS: z.coerce.number().int().min(1).max(365).default(7),
  SUPPORT_PROMPT_THRESHOLD: z.coerce.number().int().min(1).max(100).default(3),
  SUPPORT_PROMPT_WINDOW_DAYS: z.coerce.number().int().min(1).max(365).default(14),
  SUPPORT_PROMPT_COOLDOWN_DAYS: z.coerce.number().int().min(1).max(365).default(7),
  FRONTEND_URL: z.string().url(),
  TRUSTED_PROXY_ADDRESSES: z.string().default(""),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1),
  EMAIL_PROVIDER: z.enum(["disabled", "resend", "smtp"]).default("disabled"),
  EMAIL_FROM: z.union([z.email(), z.literal("")]).optional().transform((value) => value || undefined),
  RESEND_API_KEY: z.string().trim().optional().transform((value) => value || undefined),
  SMTP_HOST: z.string().trim().optional().transform((value) => value || undefined),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  SMTP_USER: z.string().trim().optional().transform((value) => value || undefined),
  SMTP_PASSWORD: z.string().optional().transform((value) => value || undefined),
  PUSH_VAPID_SUBJECT: z.string().trim().optional().transform((value) => value || undefined),
  PUSH_VAPID_PUBLIC_KEY: z.string().trim().optional().transform((value) => value || undefined),
  PUSH_VAPID_PRIVATE_KEY: z.string().trim().optional().transform((value) => value || undefined),
  GOOGLE_WEB_CLIENT_ID: z.string().trim().optional().default(""),
  SIGNUP_DRAFT_SECRET: z.string().trim().min(32).optional(),
  JOURNAL_ENCRYPTION_KEY_BASE64: base64KeySchema,
  JOURNAL_ENCRYPTION_KEY_VERSION: z.coerce.number().int().positive().default(1),
  ENCRYPTION_PREVIOUS_KEYS_JSON: z.string().default("{}").transform((value, context) => {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.values(parsed).some((key) => typeof key !== "string")) throw new Error();
      return parsed as Record<string, string>;
    } catch { context.addIssue({ code: "custom", message: "Invalid previous key configuration." }); return z.NEVER; }
  }),
  ACCOUNT_ERASURE_HMAC_KEY_BASE64: base64KeySchema.optional(),
  LOCAL_DATA_DIR: z.string().default("../../local-data/Echo"),
  AI_ANALYSIS_MODE: z.enum(["disabled", "development_stub", "local_worker", "local_json"]).default("disabled"),
  AI_DEVELOPMENT_USER_IDS: z.string().default(""),
  AI_WORKER_TOKEN: z.string().min(32).optional(),
  AI_SERVICE_URL: z.string().url().optional(),
  AI_SERVICE_TOKEN: z.string().min(32).optional(),
  AI_STUB_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(1),
  AI_JOB_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).default(60_000),
  IDEMPOTENCY_HMAC_ACTIVE_VERSION: z.string().trim().min(1).default("v1"),
  IDEMPOTENCY_HMAC_KEYS_JSON: z
    .string()
    .default("{}")
    .transform((value, context) => {
      try {
        const parsed = JSON.parse(value) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
        if (Object.values(parsed).some((key) => typeof key !== "string" || key.length < 32)) throw new Error();
        return parsed as Record<string, string>;
      } catch {
        context.addIssue({ code: "custom", message: "must be a JSON object of 32+ character secrets" });
        return z.NEVER;
      }
    }),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  REQUEST_BODY_LIMIT: z
    .string()
    .regex(/^\d+(kb|mb)$/i)
    .default("1mb"),
});

export type BackendEnvironment = z.infer<typeof environmentSchema>;

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): BackendEnvironment {
  const parsed = environmentSchema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid backend environment configuration: ${fields}`);
  }

  if (parsed.data.NODE_ENV === "production" && parsed.data.AI_ANALYSIS_MODE === "development_stub")
    throw new Error("Development stub analysis is not permitted in production.");
  if (parsed.data.AI_ANALYSIS_MODE === "local_worker" && !parsed.data.AI_WORKER_TOKEN)
    throw new Error("AI_WORKER_TOKEN is required in local_worker mode.");
  if (parsed.data.AI_SERVICE_URL && (!parsed.data.AI_SERVICE_TOKEN || !["127.0.0.1", "localhost"].includes(new URL(parsed.data.AI_SERVICE_URL).hostname)))
    throw new Error("Local AI service requires a loopback URL and dedicated bearer token.");
  if (!parsed.data.IDEMPOTENCY_HMAC_KEYS_JSON[parsed.data.IDEMPOTENCY_HMAC_ACTIVE_VERSION])
    throw new Error("The active idempotency HMAC key version is not configured.");
  if (parsed.data.NODE_ENV === "production" && !parsed.data.SIGNUP_DRAFT_SECRET) {
    throw new Error("SIGNUP_DRAFT_SECRET is required in production.");
  }
  if (parsed.data.NODE_ENV === "production" &&
      [parsed.data.FRONTEND_URL, parsed.data.SUPABASE_URL].some((value) => new URL(value).protocol !== "https:"))
    throw new Error("Production frontend and Supabase URLs must use HTTPS.");
  if (parsed.data.EMAIL_PROVIDER !== "disabled" && !parsed.data.EMAIL_FROM)
    throw new Error("EMAIL_FROM is required when email alerts are enabled.");
  if (parsed.data.EMAIL_PROVIDER === "resend" && !parsed.data.RESEND_API_KEY)
    throw new Error("RESEND_API_KEY is required for Resend alerts.");
  if (parsed.data.EMAIL_PROVIDER === "smtp" &&
      (!parsed.data.SMTP_HOST || !parsed.data.SMTP_USER || !parsed.data.SMTP_PASSWORD))
    throw new Error("SMTP_HOST, SMTP_USER and SMTP_PASSWORD are required for SMTP alerts.");
  if ([parsed.data.PUSH_VAPID_SUBJECT, parsed.data.PUSH_VAPID_PUBLIC_KEY, parsed.data.PUSH_VAPID_PRIVATE_KEY]
    .some(Boolean) && ![parsed.data.PUSH_VAPID_SUBJECT, parsed.data.PUSH_VAPID_PUBLIC_KEY, parsed.data.PUSH_VAPID_PRIVATE_KEY]
    .every(Boolean))
    throw new Error("All PUSH_VAPID values are required to enable device alerts.");
  if (parsed.data.PUSH_VAPID_SUBJECT && parsed.data.PUSH_VAPID_PUBLIC_KEY && parsed.data.PUSH_VAPID_PRIVATE_KEY) {
    const subject = parsed.data.PUSH_VAPID_SUBJECT;
    if (!(/^mailto:[^@\s]+@[^@\s]+$/.test(subject) || /^https:\/\/[^\s]+$/.test(subject)) ||
        !/^[A-Za-z0-9_-]+$/.test(parsed.data.PUSH_VAPID_PUBLIC_KEY) ||
        !/^[A-Za-z0-9_-]+$/.test(parsed.data.PUSH_VAPID_PRIVATE_KEY) ||
        Buffer.from(parsed.data.PUSH_VAPID_PUBLIC_KEY, "base64url").length !== 65 ||
        Buffer.from(parsed.data.PUSH_VAPID_PRIVATE_KEY, "base64url").length !== 32)
      throw new Error("PUSH_VAPID values must contain a valid contact and P-256 keypair.");
  }
  if (/^(?:true|\d+|\*)$/i.test(parsed.data.TRUSTED_PROXY_ADDRESSES.trim()))
    throw new Error("Configure trusted proxy IPs/CIDRs explicitly, not a hop count or wildcard.");

  return parsed.data;
}

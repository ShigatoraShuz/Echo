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
  FRONTEND_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1),
  GOOGLE_WEB_CLIENT_ID: z.string().trim().optional().default(""),
  SIGNUP_DRAFT_SECRET: z.string().trim().min(32).optional(),
  JOURNAL_ENCRYPTION_KEY_BASE64: base64KeySchema,
  JOURNAL_ENCRYPTION_KEY_VERSION: z.coerce.number().int().positive().default(1),
  AI_ANALYSIS_MODE: z.enum(["disabled", "development_stub", "local_worker"]).default("disabled"),
  AI_DEVELOPMENT_USER_IDS: z.string().default(""),
  AI_WORKER_TOKEN: z.string().min(32).optional(),
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
  if (!parsed.data.IDEMPOTENCY_HMAC_KEYS_JSON[parsed.data.IDEMPOTENCY_HMAC_ACTIVE_VERSION])
    throw new Error("The active idempotency HMAC key version is not configured.");
  if (parsed.data.NODE_ENV === "production" && !parsed.data.SIGNUP_DRAFT_SECRET) {
    throw new Error("SIGNUP_DRAFT_SECRET is required in production.");
  }

  return parsed.data;
}

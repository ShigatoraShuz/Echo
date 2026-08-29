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
  ANALYSIS_PROVIDER: z.literal("mock").default("mock"),
  ALLOW_MOCK_ANALYSIS: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
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

  if (parsed.data.NODE_ENV === "production" && parsed.data.ANALYSIS_PROVIDER === "mock") {
    throw new Error("Mock analysis is not permitted in production.");
  }
  if (!parsed.data.ALLOW_MOCK_ANALYSIS) {
    throw new Error("Mock analysis must be explicitly enabled for this non-AI phase.");
  }
  if (parsed.data.NODE_ENV === "production" && !parsed.data.SIGNUP_DRAFT_SECRET) {
    throw new Error("SIGNUP_DRAFT_SECRET is required in production.");
  }

  return parsed.data;
}

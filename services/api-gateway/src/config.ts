import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65_535).default(4200),
  FRONTEND_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  USER_SERVICE_TOKEN: z.string().min(32),
  JOURNAL_SERVICE_TOKEN: z.string().min(32),
  ASSESSMENT_SERVICE_TOKEN: z.string().min(32),
  ANALYSIS_SERVICE_TOKEN: z.string().min(32),
  RECOMMENDATION_SERVICE_TOKEN: z.string().min(32),
  WELLNESS_SERVICE_TOKEN: z.string().min(32),
  INSIGHTS_SERVICE_TOKEN: z.string().min(32),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(100).max(120_000).default(5_000),
  USER_SERVICE_URL: z.string().url(),
  JOURNAL_SERVICE_URL: z.string().url(),
  ASSESSMENT_SERVICE_URL: z.string().url(),
  ANALYSIS_SERVICE_URL: z.string().url(),
  RECOMMENDATION_SERVICE_URL: z.string().url(),
  WELLNESS_SERVICE_URL: z.string().url(),
  INSIGHTS_SERVICE_URL: z.string().url(),
});

export type GatewayConfig = z.infer<typeof schema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const parsed = schema.safeParse(source);
  if (!parsed.success) throw new Error(`Invalid API gateway configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  return parsed.data;
}

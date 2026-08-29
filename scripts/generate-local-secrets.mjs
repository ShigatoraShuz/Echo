import { createHmac, randomBytes } from "node:crypto";

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwtSecret = process.env.SUPABASE_JWT_SECRET?.trim();
const now = Math.floor(Date.now() / 1000);

function token() {
  return randomBytes(48).toString("base64url");
}

function roleJwt(role) {
  if (!jwtSecret) return "<set SUPABASE_JWT_SECRET and rerun>";
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ aud: "authenticated", exp: now + 7 * 24 * 60 * 60, iat: now, iss: "supabase", role });
  const signature = createHmac("sha256", jwtSecret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

const values = {
  USER_SERVICE_DATABASE_KEY: roleJwt("user_service_role"),
  JOURNAL_SERVICE_DATABASE_KEY: roleJwt("journal_service_role"),
  ASSESSMENT_SERVICE_DATABASE_KEY: roleJwt("assessment_service_role"),
  ANALYSIS_SERVICE_DATABASE_KEY: roleJwt("analysis_service_role"),
  WELLNESS_SERVICE_DATABASE_KEY: roleJwt("wellness_service_role"),
  USER_SERVICE_TOKEN: token(),
  JOURNAL_SERVICE_TOKEN: token(),
  ASSESSMENT_SERVICE_TOKEN: token(),
  ANALYSIS_SERVICE_TOKEN: token(),
  ML_SERVICE_TOKEN: token(),
  RECOMMENDATION_SERVICE_TOKEN: token(),
  WELLNESS_SERVICE_TOKEN: token(),
  INSIGHTS_SERVICE_TOKEN: token(),
  JOURNAL_ENCRYPTION_KEY_BASE64: randomBytes(32).toString("base64"),
};

for (const [name, value] of Object.entries(values)) console.log(`${name}=${value}`);

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const violations = [];
const expectedTokens = {
  ".env.example": ["USER", "JOURNAL", "ASSESSMENT", "ANALYSIS", "ML", "RECOMMENDATION", "WELLNESS", "INSIGHTS"],
  "services/api-gateway/.env.example": ["USER", "JOURNAL", "ASSESSMENT", "ANALYSIS", "RECOMMENDATION", "WELLNESS", "INSIGHTS"],
  "services/user-service/.env.example": ["USER"],
  "services/journal-service/.env.example": ["JOURNAL"],
  "services/assessment-service/.env.example": ["ASSESSMENT"],
  "services/recommendation-service/.env.example": ["RECOMMENDATION"],
  "services/wellness-service/.env.example": ["USER", "WELLNESS"],
  "services/insights-service/.env.example": ["USER", "JOURNAL", "INSIGHTS"],
  "ai-service/.env.example": ["USER", "JOURNAL", "ANALYSIS", "ML", "RECOMMENDATION"],
  "ml/.env.example": ["ML"],
  "frontend/.env.example": [],
};

const expectedDatabaseKeys = {
  ".env.example": ["USER_SERVICE_DATABASE_KEY", "USER_STORAGE_KEY", "JOURNAL_SERVICE_DATABASE_KEY", "ASSESSMENT_SERVICE_DATABASE_KEY", "ANALYSIS_SERVICE_DATABASE_KEY", "RECOMMENDATION_SERVICE_DATABASE_KEY", "WELLNESS_SERVICE_DATABASE_KEY"],
  "services/user-service/.env.example": ["SUPABASE_DATABASE_KEY", "USER_STORAGE_KEY"],
  "services/journal-service/.env.example": ["SUPABASE_DATABASE_KEY"],
  "services/assessment-service/.env.example": ["SUPABASE_DATABASE_KEY"],
  "services/recommendation-service/.env.example": ["SUPABASE_DATABASE_KEY"],
  "services/wellness-service/.env.example": ["SUPABASE_DATABASE_KEY"],
  "ai-service/.env.example": ["SUPABASE_DATABASE_KEY"],
};

function variables(file) {
  const result = new Map();
  for (const line of readFileSync(resolve(root, file), "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match) result.set(match[1], match[2]);
  }
  return result;
}

for (const [file, prefixes] of Object.entries(expectedTokens)) {
  const values = variables(file);
  const actual = [...values.keys()].filter((name) => name.endsWith("_SERVICE_TOKEN")).sort();
  const expected = prefixes.map((prefix) => `${prefix}_SERVICE_TOKEN`).sort();
  if (actual.join("\n") !== expected.join("\n")) {
    violations.push(`${file}: service-token scope is ${actual.join(", ") || "empty"}; expected ${expected.join(", ") || "empty"}`);
  }
  for (const [name, value] of values) {
    const privileged = /(?:SERVICE_ROLE_KEY|DATABASE_KEY|SERVICE_TOKEN|ENCRYPTION_KEY_BASE64)$/.test(name);
    if (privileged && value.trim()) violations.push(`${file}: privileged placeholder ${name} must be blank`);
  }
  if (values.has("INTERNAL_SERVICE_TOKEN")) violations.push(`${file}: deprecated shared INTERNAL_SERVICE_TOKEN is forbidden`);
}

for (const [file, expected] of Object.entries(expectedDatabaseKeys)) {
  const actual = [...variables(file).keys()].filter((name) => name === "USER_STORAGE_KEY" || name.endsWith("_DATABASE_KEY")).sort();
  if (actual.join("\n") !== [...expected].sort().join("\n")) {
    violations.push(`${file}: database-key scope is ${actual.join(", ") || "empty"}; expected ${[...expected].sort().join(", ")}`);
  }
}

const rootValues = variables(".env.example");
if (rootValues.get("JOURNAL_ENCRYPTION_KEY_VERSION") !== "1") {
  violations.push(".env.example: JOURNAL_ENCRYPTION_KEY_VERSION must preserve compatibility version 1");
}
const compose = readFileSync(resolve(root, "docker-compose.yml"), "utf8");
if (compose.includes("INTERNAL_SERVICE_TOKEN")) violations.push("docker-compose.yml: deprecated shared internal token is forbidden");
if (/\b(?:ANALYSIS_PROVIDER|ALLOW_MOCK_ANALYSIS|AI_SERVICE_TOKEN)\b/.test(compose)) {
  violations.push("docker-compose.yml: legacy monolith analysis configuration is forbidden");
}
if (!compose.includes("SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}")) {
  violations.push("docker-compose.yml: gateway-only Supabase service-role mapping is missing");
}
const composeReferenceCounts = {
  SUPABASE_SERVICE_ROLE_KEY: 1,
  USER_SERVICE_DATABASE_KEY: 1,
  USER_STORAGE_KEY: 1,
  JOURNAL_SERVICE_DATABASE_KEY: 1,
  ASSESSMENT_SERVICE_DATABASE_KEY: 1,
  ANALYSIS_SERVICE_DATABASE_KEY: 1,
  RECOMMENDATION_SERVICE_DATABASE_KEY: 1,
  WELLNESS_SERVICE_DATABASE_KEY: 1,
  USER_SERVICE_TOKEN: 5,
  JOURNAL_SERVICE_TOKEN: 4,
  ASSESSMENT_SERVICE_TOKEN: 2,
  ANALYSIS_SERVICE_TOKEN: 2,
  ML_SERVICE_TOKEN: 2,
  RECOMMENDATION_SERVICE_TOKEN: 3,
  WELLNESS_SERVICE_TOKEN: 2,
  INSIGHTS_SERVICE_TOKEN: 2,
};
for (const [name, expected] of Object.entries(composeReferenceCounts)) {
  const actual = compose.split(`\${${name}}`).length - 1;
  if (actual !== expected) violations.push(`docker-compose.yml: ${name} is distributed ${actual} times; expected ${expected}`);
}

if (violations.length) {
  console.error(`Environment contract check failed:\n${violations.map((value) => `- ${value}`).join("\n")}`);
  process.exit(1);
}
console.log("Environment contract check passed: placeholders are blank, service tokens are least-privilege scoped, and journal key version compatibility is preserved.");

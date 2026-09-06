import { createOwnedDatabase, env, listen, positiveIntegerEnv, secretEnv } from "@echo/service-core";
import { createAssessmentApp } from "./app.js";
import { AssessmentService } from "./assessment.js";
const service = new AssessmentService(
  createOwnedDatabase({
    url: env("SUPABASE_URL"),
    key: env("SUPABASE_DATABASE_KEY"),
    tables: ["mood_entries", "phq8_assessments"],
  }),
  Buffer.from(env("JOURNAL_ENCRYPTION_KEY_BASE64"), "base64"),
  positiveIntegerEnv("JOURNAL_ENCRYPTION_KEY_VERSION", 1),
  positiveIntegerEnv("PHQ8_INTERVAL_DAYS", 7),
);
const port = positiveIntegerEnv("PORT", 4203);
listen(createAssessmentApp(service, secretEnv("ASSESSMENT_SERVICE_TOKEN")), { name: "assessment-service", port });

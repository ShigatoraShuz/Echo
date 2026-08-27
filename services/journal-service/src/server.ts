import { createOwnedDatabase, env, listen, positiveIntegerEnv, secretEnv } from "@echo/service-core";
import { createJournalApp } from "./app.js";
import { createEncryption } from "./encryption.js";
import { JournalService } from "./journal.service.js";

const internalToken = secretEnv("JOURNAL_SERVICE_TOKEN");
const service = new JournalService(
  createOwnedDatabase({ url: env("SUPABASE_URL"), key: env("SUPABASE_DATABASE_KEY"), tables: ["journals", "journal_drafts"] }),
  createEncryption(env("JOURNAL_ENCRYPTION_KEY_BASE64"), positiveIntegerEnv("JOURNAL_ENCRYPTION_KEY_VERSION", 1)),
);
const port = positiveIntegerEnv("PORT", 4202);
listen(createJournalApp(service, { internalToken, allowedOrigin: process.env.FRONTEND_URL }), { name: "journal-service", port });

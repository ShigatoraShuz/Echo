import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localGoogleConfiguration } from "../scripts/lib/local-google-configuration.mts";
import { developmentConfiguration } from "../scripts/lib/local-development.mts";

vi.mock("../scripts/lib/professional-local-target.mts", () => ({
  LOCAL_API: "http://127.0.0.1:54321", FIXTURE_TAG: "echo-professional-local-v1",
  localEnvironment: () => ({ fingerprint: "123456", anonKey: "fictional-local-anon", serviceKey: "fictional-local-service" }),
  localSql: () => { throw new Error("No database operations allowed in this test"); },
}));

const audience = "123456-fictional.apps.googleusercontent.com";
let directory: string, frontend: string;
beforeEach(() => {
  directory = mkdtempSync(resolve(tmpdir(), "echo-google-environment-"));
  frontend = resolve(directory, "frontend");
  mkdirSync(frontend);
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", undefined);
  vi.stubEnv("ECHO_ACTIVE_MODELS", undefined);
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); });

describe("retained research-only Google configuration helper", () => {
  it("loads the public audience only, preserving dotenv files and the parent environment", () => {
    const content = `NEXT_PUBLIC_GOOGLE_CLIENT_ID=" ${audience} "\nGOOGLE_CLIENT_SECRET=fictional-private\nSUPABASE_SERVICE_ROLE_KEY=fictional-private-service\nSUPABASE_URL=https://unintended.invalid\n`;
    writeFileSync(resolve(frontend, ".env"), content);
    const original = { ...process.env };
    expect(localGoogleConfiguration(frontend)).toEqual({ NEXT_PUBLIC_GOOGLE_CLIENT_ID: audience, GOOGLE_WEB_CLIENT_ID: audience });
    expect(process.env).toEqual(original);
    expect(readFileSync(resolve(frontend, ".env"), "utf8")).toBe(content);
  });

  it("uses Next's development precedence, quoted values and variable expansion", () => {
    for (const [file, value] of [[".env", "base"], [".env.development", "development"], [".env.local", "local"], [".env.development.local", "override"]]) {
      writeFileSync(resolve(frontend, file), `NEXT_PUBLIC_GOOGLE_CLIENT_ID=${value}\n`);
    }
    expect(localGoogleConfiguration(frontend).GOOGLE_WEB_CLIENT_ID).toBe("override");
    writeFileSync(resolve(frontend, ".env.development.local"), `GOOGLE_PUBLIC_PREFIX=123456-fictional\nNEXT_PUBLIC_GOOGLE_CLIENT_ID="\${GOOGLE_PUBLIC_PREFIX}.apps.googleusercontent.com"\n`);
    expect(localGoogleConfiguration(frontend).GOOGLE_WEB_CLIENT_ID).toBe(audience);
    expect(localGoogleConfiguration(frontend, { ...process.env, NEXT_PUBLIC_GOOGLE_CLIENT_ID: "shell" }).GOOGLE_WEB_CLIENT_ID).toBe("shell");
    expect(localGoogleConfiguration(frontend, { ...process.env, NEXT_PUBLIC_GOOGLE_CLIENT_ID: "" }).GOOGLE_WEB_CLIENT_ID).toBe("");
  });

  it("keeps missing configuration disabled instead of inventing an audience", () => {
    expect(localGoogleConfiguration(frontend)).toEqual({ NEXT_PUBLIC_GOOGLE_CLIENT_ID: "", GOOGLE_WEB_CLIENT_ID: "" });
    writeFileSync(resolve(frontend, ".env"), "NEXT_PUBLIC_GOOGLE_CLIENT_ID='   '\n");
    expect(localGoogleConfiguration(frontend).NEXT_PUBLIC_GOOGLE_CLIENT_ID).toBe("");
  });

  it("keeps the retained research configuration isolated from ordinary workspace startup", () => {
    const repository = resolve(import.meta.dirname, "../..");
    expect(JSON.parse(readFileSync(resolve(repository, "package.json"), "utf8")).scripts.dev).toBe("node scripts/run-local-dev.mjs all");
    expect(readFileSync(resolve(repository, "backend/scripts/model-local-demo.mts"), "utf8")).toContain("developmentConfiguration(root)");
    expect(readFileSync(resolve(repository, "backend/scripts/model-local-app.mts"), "utf8")).toContain('if (mode === "development")');
    mkdirSync(resolve(directory, "backend/.local-development"), { recursive: true });
    mkdirSync(resolve(directory, "backend/models/.local"), { recursive: true });
    writeFileSync(resolve(directory, "backend/.local-development/private.json"), JSON.stringify({
      schemaVersion: "echo-local-development-v1", fingerprint: "123456", encryptionKey: Buffer.alloc(32, 1).toString("base64"),
      registrationSecret: "fictional-registration-secret-for-test-only", userIds: ["00000000-0000-0000-0000-000000000001"],
    }));
    const tasks = { cbt: "fictional-generator@v1", researchDiagnostic: "fictional-diagnostic@v1" };
    writeFileSync(resolve(directory, "backend/models/.local/active.json"), JSON.stringify({ schemaVersion: "echo-local-model-selection-v1", tasks }));
    writeFileSync(resolve(frontend, ".env"), `NEXT_PUBLIC_GOOGLE_CLIENT_ID=${audience}\nSUPABASE_URL=https://unintended.invalid\nSUPABASE_SERVICE_ROLE_KEY=unintended-private\n`);
    const config = developmentConfiguration(directory);
    expect(config.frontend.NEXT_PUBLIC_GOOGLE_CLIENT_ID).toBe(audience);
    expect(config.backend.GOOGLE_WEB_CLIENT_ID).toBe(audience);
    expect(config.frontend.NEXT_PUBLIC_SUPABASE_URL).toBe("http://127.0.0.1:54321");
    expect(config.backend.SUPABASE_URL).toBe("http://127.0.0.1:54321");
    expect(config.backend.SUPABASE_SERVICE_ROLE_KEY).toBe("fictional-local-service");
    expect(config.backend.PROFESSIONAL_EVENTS_ENABLED).toBe("false");
    expect(config.backend.AI_EXECUTION_MODE).toBe("real");
    expect(config.backend.AI_CONSULTATION_DEMO).toBe("false");
    expect(config.ai.ECHO_EXECUTION_MODE).toBe("real");
    expect(JSON.parse(config.ai.ECHO_ACTIVE_MODELS)).toEqual({ cbt: tasks.cbt });
    expect(config.researchDiagnostic).toBe(tasks.researchDiagnostic);
    expect(config.backend.JOURNAL_ENCRYPTION_KEY_BASE64).toBe(Buffer.alloc(32, 1).toString("base64"));
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
    const disabled = developmentConfiguration(directory);
    expect(disabled.frontend.NEXT_PUBLIC_GOOGLE_CLIENT_ID).toBe("");
    expect(disabled.backend.GOOGLE_WEB_CLIENT_ID).toBe("");
  });
});

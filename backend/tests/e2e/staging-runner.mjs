const scripts = {
  integration: "./live-integration.mjs",
  support: "./live-buddy-professional.mjs",
};

const script = scripts[process.argv[2]];
if (!script) throw new Error("Choose integration or support staging QA.");
if (!process.env.ECHO_QA_ENV_FILE || !process.env.ECHO_STAGING_PROJECT_REF ||
    !process.env.ECHO_STAGING_BASE_URL || !process.env.ECHO_STAGING_API_BASE_URL) {
  throw new Error("Staging QA needs ECHO_QA_ENV_FILE, ECHO_STAGING_PROJECT_REF, ECHO_STAGING_BASE_URL, and ECHO_STAGING_API_BASE_URL.");
}
if (process.argv[2] === "integration") process.env.ECHO_UI_SMOKE = "1";
await import(script);

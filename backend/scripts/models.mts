/** Offline filesystem management. No Supabase connection or model-manager HTTP API. */
import { spawn } from "node:child_process";
import { resolve } from "node:path";
const child = spawn(resolve("ai-service/.venv/Scripts/python.exe"), ["-m", "app.model.management", ...process.argv.slice(2)], {
  cwd: process.cwd(), stdio: "inherit", windowsHide: true,
  env: { ...process.env, PYTHONPATH: resolve("ai-service"), HF_HUB_OFFLINE: "1", TRANSFORMERS_OFFLINE: "1" },
});
child.on("error", () => { process.stderr.write("Use the existing ai-service/.venv Python environment. No dependencies were installed.\n"); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });

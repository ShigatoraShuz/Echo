import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const directory = resolve("backend/tmp/development-runtime");
const path = resolve(directory, "runtime.json");
if (!existsSync(path)) throw new Error("No standard local development runtime has been recorded.");
const state = JSON.parse(readFileSync(path, "utf8"));
if (state.state === "stopped") process.stdout.write("Local development is already stopped.\n");
else {
  writeFileSync(resolve(directory, "stop-request.json"), JSON.stringify({ supervisorPid: state.supervisorPid, startedAt: state.startedAt }));
  process.stdout.write("Requested coordinated shutdown of the owning Echo supervisor; local Supabase and data remain intact.\n");
}

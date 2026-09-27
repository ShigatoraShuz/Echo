import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// This task authorizes only this new non-production project. Never infer a
// migration target from mutable CLI metadata or accept arbitrary CLI refs.
export const AUTHORIZED_PROJECT_REF = "lruciislmmqvcwweqjop";
export function assertProjectUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("Invalid project URL."); }
  if (url.origin !== `https://${AUTHORIZED_PROJECT_REF}.supabase.co` ||
      url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Project target is not the authorized non-production project.");
  }
}
export async function verifyProjectTarget(root = fileURLToPath(new URL("../", import.meta.url))) {
  let count = 0;
  for (const name of [".env", "backend/.env", "frontend/.env", "frontend/.env.local"]) {
    let raw;
    try { raw = await readFile(resolve(root, name), "utf8"); }
    catch (error) { if (error.code === "ENOENT") continue; throw error; }
    const env = parseEnv(raw);
    for (const key of ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
      if (env[key]) { assertProjectUrl(env[key]); count++; }
    }
  }
  for (const key of ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"])
    if (process.env[key]) assertProjectUrl(process.env[key]);
  if (!count) throw new Error("No local project configuration was found.");
  try {
    const linked = (await readFile(resolve(root, "supabase/.temp/project-ref"), "utf8")).trim();
    if (linked !== AUTHORIZED_PROJECT_REF) throw new Error("CLI project link disagrees with the authorized target.");
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  return { project: "lruc…qjop", environment: "non-production", checkedConfigurations: count };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.info(JSON.stringify(await verifyProjectTarget())); }
  catch { console.error("Project verification failed. No remote operation was attempted."); process.exitCode = 1; }
}

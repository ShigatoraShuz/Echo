/** Local operator attestation only; no Auth, role, consent or database mutations. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { localEnvironment, localSql } from "./lib/professional-local-target.mts";
const args = process.argv.slice(2);
const id = args[args.indexOf("--user") + 1];
if (!args.includes("--user") || !args.includes("--fictional") || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id ?? ""))
  throw new Error("Usage: npm run dev:authorize -- --user UUID --fictional. Only your own fictional LOCAL test account may be enrolled.");
if (process.env.NODE_ENV === "production") throw new Error("Local development only.");
const local = localEnvironment(process.cwd());
const path = resolve("backend/.local-development/private.json");
const config = JSON.parse(readFileSync(path, "utf8"));
if (config.fingerprint !== local.fingerprint) throw new Error("Local database identity mismatch.");
if (localSql(`select count(*) from auth.users where id='${id}'::uuid and deleted_at is null;`) !== "1")
  throw new Error("Account not found in the verified local Auth database; no account created.");
const users = [...new Set<string>([...(config.userIds ?? []), id])];
if (users.length > 20) throw new Error("At most 20 explicitly authorized fictional local users are supported.");
writeFileSync(path, JSON.stringify({ ...config, userIds: users }), { mode: 0o600 });
process.stdout.write("Fictional local account enrolled in private developer configuration. Restart npm run dev. Auth, consent, verification, quota and ownership gates remain required; no database records changed.\n");

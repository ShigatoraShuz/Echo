import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const manifest = JSON.parse(readFileSync(path.join(root, "frontend/e2e/route-manifest.json"), "utf8"));
const date = new Date().toISOString().slice(0, 10);
const file = path.resolve(process.argv[2] ?? path.join(root, "artifacts/qa", `route-record-${date}.csv`));
const columns = ["date", "route", "role", "fixture", "action", "expected", "device", "observed", "requestId", "console", "network", "evidence", "defect", "status"];
const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const rows = manifest.map((entry) => [date, entry.path, entry.role, entry.fixture, entry.action, entry.expected,
  "", "", "", "", "", "", "", "pending"]);
mkdirSync(path.dirname(file), { recursive: true });
writeFileSync(file, [columns, ...rows].map((row) => row.map(quote).join(",")).join("\n") + "\n", { flag: "wx" });
console.info(`Created ${rows.length} pending route records at ${file}.`);

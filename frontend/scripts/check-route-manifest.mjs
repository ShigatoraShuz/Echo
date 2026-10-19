import assert from "node:assert/strict";
import { globSync, readFileSync } from "node:fs";
import path from "node:path";

const frontendRoot = path.resolve(import.meta.dirname, "..");
const appRoot = path.join(frontendRoot, "src", "app");
const manifest = JSON.parse(readFileSync(path.join(frontendRoot, "e2e", "route-manifest.json"), "utf8"));

function routePath(file) {
  const segments = path.dirname(file).split(/[\\/]/).filter((segment) => !/^\(.+\)$/.test(segment) && segment !== ".");
  return `/${segments.join("/")}`;
}

assert.equal(routePath("(protected)/(app)/journal/[id]/page.tsx"), "/journal/[id]");
assert.equal(routePath("(public)/page.tsx"), "/");

const discovered = globSync("**/page.*", { cwd: appRoot })
  .filter((file) => /\/page\.(?:js|jsx|ts|tsx)$/.test(file.replaceAll("\\", "/")))
  .map(routePath);
const pageRoutes = manifest.filter((entry) => entry.kind !== "callback");
const errors = [];
const validRoles = new Set(["public", "user", "practitioner", "admin"]);

for (const entry of manifest) {
  for (const field of ["path", "role", "fixture", "action", "expected", "empty", "failure"]) {
    if (typeof entry[field] !== "string" || !entry[field].trim()) errors.push(`${entry.path ?? "unknown"}: missing ${field}`);
  }
  if (!validRoles.has(entry.role)) errors.push(`${entry.path}: invalid role ${entry.role}`);
}
for (const [label, paths] of [["filesystem", discovered], ["manifest", pageRoutes.map((entry) => entry.path)]]) {
  const duplicates = paths.filter((value, index) => paths.indexOf(value) !== index);
  if (duplicates.length) errors.push(`Duplicate ${label} routes: ${[...new Set(duplicates)].join(", ")}`);
}
const declared = new Set(pageRoutes.map((entry) => entry.path));
const actual = new Set(discovered);
for (const route of actual) if (!declared.has(route)) errors.push(`Missing manifest entry: ${route}`);
for (const route of declared) if (!actual.has(route)) errors.push(`Manifest route has no page: ${route}`);
if (!manifest.some((entry) => entry.path === "/callback" && entry.kind === "callback") ||
    !globSync("**/callback/route.ts", { cwd: appRoot }).length) {
  errors.push("The authentication callback route must be mapped and present.");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.info(`Mapped ${discovered.length} pages and the authentication callback.`);
}

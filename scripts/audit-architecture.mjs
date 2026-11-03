import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontendSource = path.join(root, "frontend", "src");
const backendFeatures = path.join(root, "backend", "src", "features");
const migrations = path.join(root, "supabase", "migrations");
const relative = (file) => path.relative(root, file).replaceAll("\\", "/");
const productionFile = (file) => /\.(?:ts|tsx)$/.test(file) && !/\.(?:test|spec)\.[jt]sx?$/.test(file) && !file.includes(`${path.sep}__tests__${path.sep}`);

function* files(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* files(filename);
    else if (productionFile(filename)) yield filename;
  }
}

function imports(file) {
  const text = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  return source.statements.flatMap((statement) => {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) return [];
    if (!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) return [];
    return [{ specifier: statement.moduleSpecifier.text, line: source.getLineAndCharacterOfPosition(statement.getStart()).line + 1 }];
  });
}

function resolveFrontend(file, specifier) {
  if (specifier.startsWith("@/")) return path.join(frontendSource, specifier.slice(2));
  if (specifier.startsWith(".")) return path.resolve(path.dirname(file), specifier);
  return null;
}

const frontend = { views: [], routes: [], shared: [], infrastructure: [] };
for (const file of files(frontendSource)) {
  const sourcePath = relative(file);
  for (const item of imports(file)) {
    const target = resolveFrontend(file, item.specifier);
    if (!target) continue;
    const targetPath = relative(target);
    const detail = { file: sourcePath, line: item.line, target: item.specifier };
    if (/^frontend\/src\/features\/[^/]+\/(?:view|components)\//.test(sourcePath) && /^frontend\/src\/(?:services|infrastructure)\//.test(targetPath)) frontend.views.push(detail);
    if (/^frontend\/src\/app\//.test(sourcePath) && /\/(?:page|layout)\.tsx$/.test(sourcePath) && /^frontend\/src\/(?:services|infrastructure)\//.test(targetPath)) frontend.routes.push(detail);
    if (sourcePath.startsWith("frontend/src/shared/") && /^frontend\/src\/(?:features|services)\//.test(targetPath)) frontend.shared.push(detail);
    if (sourcePath.startsWith("frontend/src/infrastructure/") && /^frontend\/src\/(?:features|services)\//.test(targetPath)) frontend.infrastructure.push(detail);
  }
}

const backend = { crossFeatureImports: [], schemaReferences: {} };
for (const file of files(backendFeatures)) {
  const sourcePath = relative(file);
  const sourceModule = sourcePath.split("/")[3];
  for (const item of imports(file)) {
    if (!item.specifier.startsWith(".")) continue;
    const target = relative(path.resolve(path.dirname(file), item.specifier));
    const targetModule = target.startsWith("backend/src/features/") ? target.split("/")[3] : null;
    if (targetModule && targetModule !== sourceModule) backend.crossFeatureImports.push({ file: sourcePath, line: item.line, target: item.specifier });
  }
  const text = fs.readFileSync(file, "utf8");
  const schemas = [...text.matchAll(/\.schema\(\s*["']([a-z_]+)["']\s*\)/g)].map((match) => match[1]);
  if (schemas.length) backend.schemaReferences[sourceModule] = [...new Set([...(backend.schemaReferences[sourceModule] ?? []), ...schemas])].sort();
}

const requiredSchemas = ["user_service", "journal_service", "buddy_service", "grounding_service", "insights_service", "notification_service", "verification_service", "professional_service", "ai_analysis"];
const migrationText = fs.readdirSync(migrations).filter((name) => name.endsWith(".sql")).map((name) => fs.readFileSync(path.join(migrations, name), "utf8")).join("\n");
const database = { requiredSchemas, missingSchemaDeclarations: requiredSchemas.filter((schema) => !new RegExp(`create\\s+schema\\s+(?:if\\s+not\\s+exists\\s+)?${schema}\\b`, "i").test(migrationText)) };
const report = { frontend, backend, database };

if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
else {
  for (const [group, entries] of Object.entries(frontend)) {
    console.log(`frontend ${group}: ${entries.length} dependency edges`);
    for (const entry of entries.slice(0, 8)) console.log(`  ${entry.file}:${entry.line} -> ${entry.target}`);
  }
  console.log(`backend cross-feature imports: ${backend.crossFeatureImports.length} dependency edges`);
  for (const entry of backend.crossFeatureImports.slice(0, 12)) console.log(`  ${entry.file}:${entry.line} -> ${entry.target}`);
  console.log("backend feature schema references:", JSON.stringify(backend.schemaReferences));
  console.log("missing database schema declarations:", database.missingSchemaDeclarations.join(", ") || "none");
}

if (process.argv.includes("--strict") && (
  Object.values(frontend).some((entries) => entries.length > 0) ||
  backend.crossFeatureImports.length > 0 || database.missingSchemaDeclarations.length > 0
)) process.exitCode = 1;

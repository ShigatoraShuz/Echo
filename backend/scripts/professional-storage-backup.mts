/** GET-only export and private filesystem restore. No remote Storage mutations. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { cloudReadOnly, cloudProject } from "./lib/professional-cloud-readonly.mts";

const sha = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
let phase = "preflight";
async function main() {
  const directory = resolve((await readFile(new URL("../tmp/professional-release/backup-location.txt", import.meta.url), "utf8")).trim());
  if (!directory.startsWith(resolve(process.env.USERPROFILE!, "EchoBackups") + sep) || !directory.split(sep).at(-1)?.startsWith(cloudProject + "_")) throw new Error("Private external backup destination required.");
  const verification = JSON.parse(await readFile(join(directory, "verification.json"), "utf8"));
  if (verification.project !== cloudProject || verification.restore !== "VERIFIED") throw new Error("Verified database backup required.");
  for (const file of verification.files) {
    if (!["database.dump", "roles.sql", "source-metadata.json", "archive-toc.txt"].includes(file.file) || sha(await readFile(join(directory, file.file))) !== file.sha256) throw new Error("Database backup integrity mismatch.");
  }
  const cloud = await cloudReadOnly();
  phase = "inventory";
  const inventorySql = "select json_build_object('buckets',(select coalesce(json_agg(to_jsonb(b) order by id),'[]') from storage.buckets b),'objects',(select coalesce(json_agg(to_jsonb(o) order by id),'[]') from storage.objects o)) as inventory";
  const inventory = (await cloud.query(inventorySql))[0].inventory;
  if (inventory.objects.length !== 20 || inventory.buckets.length !== 3) throw new Error("Cloud Storage inventory changed from the verified backup.");
  const exportDirectory = join(directory, "storage");
  await mkdir(join(exportDirectory, "objects"), { recursive: true });
  await writeFile(join(exportDirectory, "metadata.json"), JSON.stringify(inventory, null, 2) + "\n");
  const entries = [];
  phase = "download";
  for (const object of inventory.objects) {
    if (!/^[a-f0-9-]{36}$/.test(object.id)) throw new Error("Unexpected Storage object identifier.");
    const response = await cloud.storageGet(object.bucket_id, object.name);
    const bytes = Buffer.from(await response.arrayBuffer());
    if ((object.metadata?.size != null && Number(object.metadata.size) !== bytes.length) ||
      (response.headers.has("content-length") && Number(response.headers.get("content-length")) !== bytes.length)) throw new Error("Storage object size mismatch.");
    const etag = response.headers.get("etag")?.replaceAll('"', "");
    const md5Checked = !!etag && /^[a-f0-9]{32}$/i.test(etag);
    if (md5Checked && createHash("md5").update(bytes).digest("hex") !== etag!.toLowerCase()) throw new Error("Storage ETag integrity mismatch.");
    const file = object.id + ".bin";
    await writeFile(join(exportDirectory, "objects", file), bytes);
    entries.push({ id: object.id, bucket: object.bucket_id, name: object.name, file, bytes: bytes.length, sha256: sha(bytes), md5Checked });
  }
  // Detect concurrent inventory/metadata changes instead of certifying a mixed backup.
  if (JSON.stringify((await cloud.query(inventorySql))[0].inventory) !== JSON.stringify(inventory)) throw new Error("Storage inventory changed during backup; retry required.");
  await writeFile(join(exportDirectory, "manifest.json"), JSON.stringify(entries, null, 2) + "\n");
  phase = "isolated-filesystem-restore";
  const restore = join(directory, "storage-restore-" + Date.now());
  const restoredPaths = new Set<string>();
  let totalBytes = 0;
  for (const entry of entries) {
    const segments = [entry.bucket, ...entry.name.split("/")];
    if (segments.some((part) => !part || part === "." || part === ".." || /[<>:"\\|?*]/.test(part) || /[. ]$/.test(part) || [...part].some((character) => character.codePointAt(0)! < 32))) throw new Error("Storage key cannot be safely restored to Windows filesystem.");
    const target = resolve(restore, ...segments);
    if (!target.startsWith(resolve(restore) + sep) || restoredPaths.has(target.toLowerCase())) throw new Error("Unsafe or colliding restore path.");
    restoredPaths.add(target.toLowerCase());
    const bytes = await readFile(join(exportDirectory, "objects", entry.file));
    if (sha(bytes) !== entry.sha256) throw new Error("Saved object checksum mismatch.");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: "wx" });
    if (sha(await readFile(target)) !== entry.sha256 || (await stat(target)).size !== entry.bytes) throw new Error("Restored object checksum mismatch.");
    totalBytes += entry.bytes;
  }
  const result = { project: cloudProject, status: "VERIFIED", verifiedAtUtc: new Date().toISOString(), objects: entries.length,
    buckets: inventory.buckets.length, totalBytes, etagMd5Checks: entries.filter((entry) => entry.md5Checked).length,
    checksumChecks: entries.length, restoreMethod: "private isolated filesystem; original bucket/object paths reconstructed and bytes reread",
    databaseBackupHashesUnchanged: true, metadataSha256: sha(await readFile(join(exportDirectory, "metadata.json"))),
    manifestSha256: sha(await readFile(join(exportDirectory, "manifest.json"))), restoreDirectory: restore };
  await writeFile(join(exportDirectory, "verification.json"), JSON.stringify(result, null, 2) + "\n");
  process.stdout.write(JSON.stringify({ ...result, restoreDirectory: "private external backup directory" }, null, 2) + "\n");
}
main().catch(() => { process.stderr.write(`Storage backup BLOCKED at ${phase}; no remote mutation attempted.\n`); process.exitCode = 1; });

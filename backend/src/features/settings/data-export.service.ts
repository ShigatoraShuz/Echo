import type { SupabaseClient } from "@supabase/supabase-js";
import {
  decryptText,
  encryptText,
  type EncryptionService,
} from "../../infrastructure/encryption/encryption.service.js";
import {
  AppError,
  ConflictError,
  ExternalServiceError,
  NotFoundError,
  PayloadTooLargeError,
} from "../../shared/errors/app-error.js";

type Row = Record<string, unknown>;
type Collections = Record<string, Row[]>;
const MAX_EXPORT_BYTES = 24_000_000;
const MAX_FILES = 16;
const unavailable = () =>
  new ExternalServiceError("EXPORT_UNAVAILABLE", "Your export could not be prepared. Please try again.");
function base64(value: unknown): string {
  if (typeof value !== "string") throw unavailable();
  return value.startsWith("\\x") ? Buffer.from(value.slice(2), "hex").toString("base64") : value;
}
function parseContent(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** Only called with rows from the fixed, owner-filtered export snapshot. */
export function decryptExportCollections(input: Collections, encryption: EncryptionService): Collections {
  return Object.fromEntries(
    Object.entries(input).map(([table, rows]) => [
      table,
      rows.map((row) => {
        const result: Row = { ...row };
        for (const field of Object.keys(row).filter((key) => key.endsWith("_ciphertext"))) {
          const prefix = field.slice(0, -"ciphertext".length);
          const independent = row[prefix + "iv"] !== undefined;
          const metadataPrefix = independent ? prefix : "encryption_";
          if (typeof row[field] === "string" && row[field].startsWith("echo:encrypted:v1:")) {
            result[prefix.slice(0, -1)] = parseContent(decryptText(row[field], encryption));
          } else if (row[field] != null) {
            result[prefix.slice(0, -1)] = parseContent(
              encryption.decrypt({
                ciphertext: base64(row[field]),
                iv: base64(row[metadataPrefix + "iv"]),
                authenticationTag: base64(row[metadataPrefix + "auth_tag"]),
                keyVersion: Number(row[metadataPrefix + "key_version"]),
              }),
            );
          }
          delete result[field];
          for (const suffix of ["iv", "auth_tag", "key_version"]) delete result[metadataPrefix + suffix];
        }
        if (typeof result.content === "string" && result.content.startsWith("echo:encrypted:v1:"))
          result.content = decryptText(result.content, encryption);
        const payload = result.result_payload as Row | undefined;
        if (payload && typeof payload.ciphertext === "string")
          result.result_payload = parseContent(decryptText(payload.ciphertext, encryption));
        return result;
      }),
    ]),
  );
}

export class DataExportService {
  private active = 0;
  constructor(
    private readonly database: SupabaseClient,
    private readonly encryption: EncryptionService,
  ) {}

  async prepare(userId: string): Promise<string> {
    if (this.active >= 2)
      throw new ExternalServiceError("EXPORT_BUSY", "Export processing is busy. Please retry shortly.");
    this.active++;
    let requestId: string | undefined;
    try {
      const started = await this.database.schema("user_service").rpc("begin_data_export", { p_user_id: userId });
      if (started.error?.message.includes("EXPORT_BUSY"))
        throw new ConflictError("EXPORT_BUSY", "An export is already being prepared.");
      if (started.error?.message.includes("EXPORT_LIMIT"))
        throw new AppError({
          statusCode: 429,
          code: "EXPORT_LIMIT",
          message: "You can request up to three exports per day.",
        });
      if (started.error || typeof started.data !== "string") throw unavailable();
      requestId = started.data;
      const [snapshot, account] = await Promise.all([
        this.database.schema("user_service").rpc("collect_user_export", { p_user_id: userId }),
        this.database.auth.admin.getUserById(userId),
      ]);
      if (snapshot.error?.message.includes("EXPORT_TOO_LARGE"))
        throw new PayloadTooLargeError(
          "This export exceeds automatic delivery limits. Contact support for a larger export.",
        );
      if (snapshot.error || !snapshot.data || account.error || account.data.user?.id !== userId) throw unavailable();
      const collections = decryptExportCollections(snapshot.data as Collections, this.encryption);
      const attachments = await this.collectFiles(userId, collections);
      const plaintext = JSON.stringify({
        format: "echo-account-export-v1",
        userId,
        requestId,
        generatedAt: new Date().toISOString(),
        account: { email: account.data.user.email ?? null, createdAt: account.data.user.created_at },
        collections,
        attachments,
        exclusions: [
          "Authentication credentials, worker secrets and operator authority records are excluded.",
          "Unscanned or quarantined verification files are listed as metadata only for safety.",
          "Provider copies and backup snapshots require the documented provider/privacy process.",
        ],
      });
      if (Buffer.byteLength(plaintext) > MAX_EXPORT_BYTES)
        throw new PayloadTooLargeError(
          "This export exceeds automatic delivery limits. Contact support for a larger export.",
        );
      const finished = await this.database.schema("user_service").rpc("finish_data_export", {
        p_user_id: userId,
        p_request_id: requestId,
        p_ciphertext: encryptText(plaintext, this.encryption),
      });
      if (finished.error) throw unavailable();
      return requestId;
    } catch (error) {
      if (requestId) {
        await this.database
          .schema("user_service")
          .from("data_export_requests")
          .update({ request_status: "failed" })
          .eq("id", requestId)
          .eq("user_id", userId)
          .eq("request_status", "processing");
      }
      if (error instanceof AppError) throw error;
      throw unavailable();
    } finally {
      this.active--;
    }
  }

  private async collectFiles(userId: string, collections: Collections) {
    const files = new Map<string, { bucket: string; path: string; mimeType: string }>();
    for (const [table, rows] of Object.entries(collections)) {
      for (const row of rows) {
        const avatar =
          table.endsWith(".profiles") && typeof row.avatar_path === "string"
            ? row.avatar_path.split("/storage/v1/object/public/avatars/").at(-1)
            : null;
        const bucket = avatar?.startsWith(userId + "/")
          ? "avatars"
          : table.endsWith(".journal_images")
            ? "journal-images"
            : table.endsWith(".verification_documents") && row.scan_status === "clean"
              ? "verification-documents"
              : null;
        if (!bucket || (bucket === "journal-images" && row.uploaded !== true)) continue;
        const path = bucket === "avatars" ? avatar : row.storage_path;
        if (typeof path !== "string") throw unavailable();
        if (
          !path.startsWith(userId + "/") ||
          !/^[a-zA-Z0-9_./-]+$/.test(path) ||
          path.split("/").some((segment) => segment === "." || segment === "..")
        )
          throw unavailable();
        files.set(bucket + "/" + path, {
          bucket,
          path,
          mimeType: typeof row.mime_type === "string" ? row.mime_type : "application/octet-stream",
        });
      }
    }
    if (files.size > MAX_FILES)
      throw new PayloadTooLargeError(
        "This account has too many attachments for automatic delivery. Contact support for a larger export.",
      );
    const result: Array<{ path: string; mimeType: string; base64: string }> = [];
    const deadline = Date.now() + 60_000;
    let size = Buffer.byteLength(JSON.stringify(collections));
    for (const file of files.values()) {
      if (Date.now() >= deadline) throw unavailable();
      const downloaded = await this.database.storage.from(file.bucket).download(file.path);
      if (downloaded.error || !downloaded.data || Date.now() >= deadline || downloaded.data.size > 8 * 1024 * 1024)
        throw unavailable();
      size += Math.ceil(downloaded.data.size / 3) * 4;
      if (size > MAX_EXPORT_BYTES)
        throw new PayloadTooLargeError(
          "This export exceeds automatic delivery limits. Contact support for a larger export.",
        );
      result.push({
        path: file.bucket + "/" + file.path,
        mimeType: file.mimeType,
        base64: Buffer.from(await downloaded.data.arrayBuffer()).toString("base64"),
      });
    }
    return result;
  }

  async download(userId: string, requestId: string): Promise<string> {
    if (this.active >= 2)
      throw new ExternalServiceError("EXPORT_BUSY", "Export processing is busy. Please retry shortly.");
    this.active++;
    try {
      const result = await this.database
        .schema("user_service")
        .rpc("consume_data_export", { p_user_id: userId, p_request_id: requestId });
      if (result.error) throw unavailable();
      if (typeof result.data !== "string")
        throw new NotFoundError("This export is unavailable, expired or already downloaded.");
      try {
        const plaintext = decryptText(result.data, this.encryption);
        const payload = JSON.parse(plaintext) as Row;
        if (payload.userId !== userId || payload.requestId !== requestId || payload.format !== "echo-account-export-v1")
          throw unavailable();
        return plaintext;
      } catch {
        throw unavailable();
      }
    } finally {
      this.active--;
    }
  }

  async expire(): Promise<void> {
    const { error } = await this.database.schema("user_service").rpc("expire_data_exports");
    if (error) throw unavailable();
  }
}

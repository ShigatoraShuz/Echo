import type { SupabaseClient } from "@supabase/supabase-js";
import type { EncryptionService } from "../../infrastructure/encryption/encryption.service.js";

type Row = Record<string, unknown>;
export interface CiphertextCoverage {
  covered: number;
  backfilledMissing: number;
  mismatched: number;
  unreadable: number;
  complete: boolean;
}

function fromBytea(value: unknown): string {
  if (typeof value !== "string") throw new Error("invalid encrypted payload");
  return value.startsWith("\\x") ? Buffer.from(value.slice(2), "hex").toString("base64") : value;
}
function toBytea(value: string): string {
  return `\\x${Buffer.from(value, "base64").toString("hex")}`;
}

export class CiphertextBackfillService {
  constructor(
    private readonly database: SupabaseClient,
    private readonly encryption: EncryptionService,
  ) {}

  async run(): Promise<CiphertextCoverage> {
    const coverage: CiphertextCoverage = {
      covered: 0,
      backfilledMissing: 0,
      mismatched: 0,
      unreadable: 0,
      complete: false,
    };
    for (const table of ["journals", "journal_drafts"] as const) {
      const key = table === "journals" ? "id" : "user_id";
      let cursor: string | undefined;
      for (;;) {
        let query = this.database.schema("journal_service").from(table).select("*").order(key).limit(200);
        if (cursor) query = query.gt(key, cursor);
        const { data, error } = await query;
        if (error) throw new Error("Ciphertext coverage could not be read.");
        if (!data?.length) break;
        for (const row of data as Row[]) await this.processRow(table, row, coverage);
        cursor = String(data.at(-1)![key]);
      }
    }
    for (const table of ["journals", "journal_drafts"] as const) {
      let cursor: string | undefined;
      for (;;) {
        let query = this.database.from(table).select("*").order("id").limit(200);
        if (cursor) query = query.gt("id", cursor);
        const { data, error } = await query;
        if (error) throw new Error("Legacy ciphertext coverage could not be read.");
        if (!data?.length) break;
        for (const row of data as Row[]) await this.processPublicRow(table, row, coverage);
        cursor = String(data.at(-1)!.id);
      }
    }
    coverage.complete = coverage.mismatched === 0 && coverage.unreadable === 0;
    await this.database
      .schema("user_service")
      .from("audit_events")
      .insert({
        event_type: "journal.ciphertext_coverage",
        resource_type: "journal_backfill",
        metadata: {
          covered: coverage.covered,
          backfilled_missing: coverage.backfilledMissing,
          mismatched: coverage.mismatched,
          unreadable: coverage.unreadable,
          complete: coverage.complete,
        },
      });
    return coverage;
  }

  private async processRow(
    table: "journals" | "journal_drafts",
    row: Row,
    coverage: CiphertextCoverage,
  ): Promise<void> {
    try {
      const plaintext = this.encryption.decrypt({
        ciphertext: fromBytea(row.content_ciphertext),
        iv: fromBytea(row.encryption_iv),
        authenticationTag: fromBytea(row.encryption_auth_tag),
        keyVersion: Number(row.encryption_key_version),
      });
      const parsed = JSON.parse(plaintext) as { title?: unknown; body?: unknown };
      const legacyTitle = typeof row.title === "string" && row.title !== "[encrypted]" ? row.title : undefined;
      if (typeof parsed.body !== "string") throw new Error("missing body");
      if (typeof parsed.title === "string") {
        if (legacyTitle !== undefined && legacyTitle !== parsed.title) {
          coverage.mismatched += 1;
          return;
        }
      } else {
        if (legacyTitle === undefined) throw new Error("missing title");
        const encrypted = this.encryption.encrypt(JSON.stringify({ ...parsed, title: legacyTitle }));
        await this.update(table, row, {
          content_ciphertext: toBytea(encrypted.ciphertext),
          encryption_iv: toBytea(encrypted.iv),
          encryption_auth_tag: toBytea(encrypted.authenticationTag),
          encryption_key_version: encrypted.keyVersion,
          title: "[encrypted]",
        });
        coverage.backfilledMissing += 1;
        return;
      }
      if (row.title !== "[encrypted]") await this.update(table, row, { title: "[encrypted]" });
      coverage.covered += 1;
    } catch {
      coverage.unreadable += 1;
    }
  }

  private async update(table: "journals" | "journal_drafts", row: Row, values: Row): Promise<void> {
    const key = table === "journals" ? "id" : "user_id";
    const { error, count } = await this.database
      .schema("journal_service")
      .from(table)
      .update(values, { count: "exact" })
      .eq(key, row[key])
      .eq("content_ciphertext", row.content_ciphertext)
      .eq("title", row.title);
    if (error || count !== 1) throw new Error("Ciphertext backfill could not be saved or changed concurrently.");
  }

  private async processPublicRow(
    table: "journals" | "journal_drafts",
    row: Row,
    coverage: CiphertextCoverage,
  ): Promise<void> {
    try {
      let parsed: { title?: unknown; body?: unknown };
      let needsEncryption = false;
      if (row.content_ciphertext) {
        parsed = JSON.parse(
          this.encryption.decrypt({
            ciphertext: fromBytea(row.content_ciphertext),
            iv: fromBytea(row.encryption_iv),
            authenticationTag: fromBytea(row.encryption_auth_tag),
            keyVersion: Number(row.encryption_key_version),
          }),
        );
      } else {
        if (
          table !== "journals" ||
          row.title_ciphertext ||
          typeof row.title !== "string" ||
          typeof row.content !== "string" ||
          row.title === "[encrypted]" ||
          row.content === "[encrypted]"
        )
          throw new Error("Unreadable legacy format");
        parsed = { title: row.title, body: row.content };
        needsEncryption = true;
      }
      if (typeof parsed.body !== "string") throw new Error("Unreadable legacy body");
      if (table === "journal_drafts") {
        if (typeof parsed.title !== "string") throw new Error("Unreadable legacy title");
        coverage.covered += 1;
        return;
      }
      const plaintextTitle = typeof row.title === "string" && row.title !== "[encrypted]" ? row.title : undefined;
      const plaintextBody = typeof row.content === "string" && row.content !== "[encrypted]" ? row.content : undefined;
      if (
        (typeof parsed.title === "string" && plaintextTitle !== undefined && parsed.title !== plaintextTitle) ||
        (plaintextBody !== undefined && parsed.body !== plaintextBody)
      ) {
        coverage.mismatched += 1;
        return;
      }
      if (typeof parsed.title !== "string") {
        // A separate historical encrypted title cannot safely be inferred from plaintext.
        if (plaintextTitle === undefined || row.title_ciphertext) throw new Error("Unreadable legacy title");
        parsed.title = plaintextTitle;
        needsEncryption = true;
      }
      const values: Row = { title: "[encrypted]", content: "[encrypted]" };
      if (needsEncryption) {
        const encrypted = encryptionFields(this.encryption.encrypt(JSON.stringify(parsed)));
        Object.assign(values, encrypted);
      }
      let update = this.database
        .from("journals")
        .update(values, { count: "exact" })
        .eq("id", row.id)
        .eq("updated_at", row.updated_at);
      update = row.content_ciphertext
        ? update.eq("content_ciphertext", row.content_ciphertext)
        : update.is("content_ciphertext", null);
      const { error, count } = await update;
      if (error || count !== 1) throw new Error("Legacy backfill changed concurrently");
      if (needsEncryption) coverage.backfilledMissing += 1;
      else coverage.covered += 1;
    } catch {
      coverage.unreadable += 1;
    }
  }
}

function encryptionFields(encrypted: ReturnType<EncryptionService["encrypt"]>): Row {
  return {
    content_ciphertext: toBytea(encrypted.ciphertext),
    encryption_iv: toBytea(encrypted.iv),
    encryption_auth_tag: toBytea(encrypted.authenticationTag),
    encryption_key_version: encrypted.keyVersion,
  };
}

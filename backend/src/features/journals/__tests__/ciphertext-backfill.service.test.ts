import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createEncryptionService } from "../../../infrastructure/encryption/encryption.service.js";
import { CiphertextBackfillService } from "../ciphertext-backfill.service.js";

const encryption = createEncryptionService(Buffer.alloc(32, 9).toString("base64"), 1);
type Row = Record<string, unknown>;
function encryptedRow(title: string, payload: unknown): Row {
  const encrypted = encryption.encrypt(JSON.stringify(payload));
  return {
    id: "journal-1",
    title,
    content_ciphertext: encrypted.ciphertext,
    encryption_iv: encrypted.iv,
    encryption_auth_tag: encrypted.authenticationTag,
    encryption_key_version: 1,
  };
}
function databaseWith(rows: Row[], concurrentChange = false) {
  const writes: Row[] = [];
  const database = {
    from: () => {
      const empty = {
        select: () => empty,
        order: () => empty,
        limit: () => Promise.resolve({ data: [], error: null }),
      };
      return empty;
    },
    schema: () => ({
      from: (table: string) => {
        let after = false;
        let values: Row | undefined;
        const query = {
          select: () => query,
          order: () => query,
          limit: () => query,
          eq: () => query,
          gt: () => {
            after = true;
            return query;
          },
          update: (input: Row) => {
            values = input;
            return query;
          },
          insert: () => Promise.resolve({ error: null }),
          then: (resolve: (value: unknown) => unknown) => {
            if (values) {
              writes.push(values);
              return Promise.resolve(resolve({ error: null, count: concurrentChange ? 0 : 1 }));
            }
            return Promise.resolve(resolve({ error: null, data: table === "journals" && !after ? rows : [] }));
          },
        };
        return query;
      },
    }),
  } as unknown as SupabaseClient;
  return { database, writes };
}

describe("ciphertext title authority and coverage", () => {
  it("does not overwrite ciphertext when the legacy title differs", async () => {
    const { database, writes } = databaseWith([
      encryptedRow("Legacy title", { title: "Authoritative title", body: "Private body" }),
    ]);
    expect(await new CiphertextBackfillService(database, encryption).run()).toMatchObject({
      mismatched: 1,
      complete: false,
    });
    expect(writes).toHaveLength(0);
  });
  it("backfills only missing encrypted titles and replaces plaintext with a sentinel", async () => {
    const { database, writes } = databaseWith([encryptedRow("Legacy title", { body: "Private body" })]);
    expect(await new CiphertextBackfillService(database, encryption).run()).toMatchObject({
      backfilledMissing: 1,
      complete: true,
    });
    expect(writes[0].title).toBe("[encrypted]");
    const decode = (value: unknown) => Buffer.from(String(value).slice(2), "hex").toString("base64");
    const decrypted = encryption.decrypt({
      ciphertext: decode(writes[0].content_ciphertext),
      iv: decode(writes[0].encryption_iv),
      authenticationTag: decode(writes[0].encryption_auth_tag),
      keyVersion: 1,
    });
    expect(JSON.parse(decrypted)).toEqual({ title: "Legacy title", body: "Private body" });
  });
  it("covers matching titles without changing ciphertext", async () => {
    const { database, writes } = databaseWith([encryptedRow("Same", { title: "Same", body: "Text" })]);
    expect(await new CiphertextBackfillService(database, encryption).run()).toMatchObject({
      covered: 1,
      complete: true,
    });
    expect(writes).toEqual([{ title: "[encrypted]" }]);
  });
  it("is resumable when a covered row already uses the sentinel", async () => {
    const { database, writes } = databaseWith([encryptedRow("[encrypted]", { title: "Real title", body: "Text" })]);
    expect(await new CiphertextBackfillService(database, encryption).run()).toMatchObject({
      covered: 1,
      complete: true,
    });
    expect(writes).toHaveLength(0);
  });
  it("fails coverage on unauthenticated ciphertext without returning private content", async () => {
    const row = encryptedRow("Private title", { title: "Private title", body: "Private body" });
    row.encryption_auth_tag = Buffer.alloc(16).toString("base64");
    const { database } = databaseWith([row]);
    const coverage = await new CiphertextBackfillService(database, encryption).run();
    expect(coverage).toMatchObject({ unreadable: 1, complete: false });
    expect(JSON.stringify(coverage)).not.toMatch(/Private/);
  });
  it("fails coverage instead of overwriting a concurrent edit", async () => {
    const { database } = databaseWith([encryptedRow("Same", { title: "Same", body: "Text" })], true);
    expect(await new CiphertextBackfillService(database, encryption).run()).toMatchObject({
      covered: 0,
      unreadable: 1,
      complete: false,
    });
  });
});

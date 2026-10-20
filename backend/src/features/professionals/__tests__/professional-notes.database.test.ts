import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encryptedFixture, ids, professionalDatabase, seedProfessionalDatabase, serviceRole } from "../../../../tests/fixtures/professional-database.js";
let db: PGlite;
beforeAll(async () => { db = await professionalDatabase(["20261014110000_professional_claim_lifecycle.sql", "20261015100000_professional_case_snapshot.sql", "20261015110000_professional_consent.sql", "20261015120000_professional_notes.sql"]); }, 30_000);
beforeEach(async () => { await seedProfessionalDatabase(db); await db.query("select professional_service.claim_request($1,$2)", [ids.request, ids.actor]); });
afterAll(async () => db?.close());
interface Note { id: string; body_encrypted: string; state: string; revision: number; finalized_at: Date | null }
const save = async (state = "final", actor = ids.actor, key = ids.owner) => (await db.query<Note>("select * from professional_service.save_case_note($1,$2,$3,$4,$5)", [ids.request, actor, encryptedFixture, key, state])).rows[0];
const edit = async (id: string, revision: number, finalize: boolean, actor = ids.actor) => (await db.query<Note>("select * from professional_service.edit_case_note($1,$2,$3,$4,$5,$6)", [ids.request, id, actor, encryptedFixture, revision, finalize])).rows[0];

describe("secure note lifecycle", () => {
  it("creates final notes and replays an uncertain save without another row or audit", async () => {
    const first = await save(); expect(first.state).toBe("final"); expect(first.finalized_at).not.toBeNull();
    expect(await save()).toEqual(first);
    expect((await db.query("select id from professional_service.case_notes")).rows).toHaveLength(1);
    expect((await db.query("select id from professional_service.audit_events where action='note.created'")).rows).toHaveLength(1);
  });
  it("edits only the expected draft revision, finalizes once, and preserves final content", async () => {
    const draft = await save("draft"); expect(draft.finalized_at).toBeNull();
    const updated = await edit(draft.id, 1, false); expect(updated.revision).toBe(2);
    await expect(edit(draft.id, 1, false)).rejects.toThrow("NOTE_REVISION_CONFLICT");
    const final = await edit(draft.id, 2, true); expect(final.state).toBe("final"); expect(final.revision).toBe(3);
    expect(await edit(draft.id, 2, true)).toEqual(final);
    await expect(edit(draft.id, 3, false)).rejects.toThrow("NOTE_IMMUTABLE");
    expect((await db.query("select id from professional_service.audit_events where action='note.finalized'")).rows).toHaveLength(1);
    await db.exec("reset role");
    await expect(db.query("update professional_service.case_notes set body_encrypted=$1,revision=revision+1 where id=$2", [encryptedFixture, draft.id])).rejects.toThrow("NOTE_IMMUTABLE");
  });
  it.each([ids.second, ids.outsider, ids.owner])("denies other actors %s before create/edit", async (actor) => {
    const draft = await save("draft");
    await expect(save("draft", actor)).rejects.toThrow("REQUEST_NOT_FOUND");
    await expect(edit(draft.id, 1, true, actor)).rejects.toThrow("REQUEST_NOT_FOUND");
  });
  it("blocks new writes after closure while permitting an authorized final-save replay", async () => {
    const final = await save(); const draft = await save("draft", ids.actor, ids.second);
    await db.query("select professional_service.set_request_status($1,$2,'closed')", [ids.request, ids.actor]);
    expect(await save()).toEqual(final);
    await expect(save("final", ids.actor, ids.outsider)).rejects.toThrow("INVALID_CASE_TRANSITION");
    await expect(edit(draft.id, 1, true)).rejects.toThrow("INVALID_CASE_TRANSITION");
  });
  it("rechecks membership even for a replay", async () => {
    await save(); await db.exec("reset role"); await db.query("update professional_service.memberships set status='suspended' where user_id=$1", [ids.actor]); await serviceRole(db);
    await expect(save()).rejects.toThrow("MEMBERSHIP_REQUIRED");
  });
  it("returns own drafts but conceals them from a later assignee; final notes remain case records", async () => {
    const draft = await save("draft"); const final = await save("final", ids.actor, ids.second);
    const read = async () => (await db.query<{ result: { notes: Note[] } }>("select professional_service.case_snapshot($1,$2) result", [ids.request, ids.actor])).rows[0].result;
    expect((await read()).notes).toHaveLength(2);
    // Isolated owner simulation of a historical other-author draft. Production
    // RPCs never permit changing an author or implicit reassignment.
    await db.exec("reset role; alter table professional_service.case_notes disable trigger professional_note_edit_guard");
    try { await db.query("update professional_service.case_notes set author_user_id=$1 where id=$2", [ids.second, draft.id]); }
    finally { await db.exec("alter table professional_service.case_notes enable trigger professional_note_edit_guard"); }
    await serviceRole(db);
    expect((await read()).notes.map((n) => n.id)).toEqual([final.id]);
    await expect(edit(draft.id, 1, true)).rejects.toThrow("REQUEST_NOT_FOUND");
  });
  it("rolls back a note when audit insertion fails", async () => {
    await db.exec("reset role; alter table professional_service.audit_events add constraint synthetic_note_audit_fail check(action<>'note.created')");
    try { await serviceRole(db); await expect(save()).rejects.toThrow("synthetic_note_audit_fail"); expect((await db.query("select id from professional_service.case_notes")).rows).toEqual([]); }
    finally { await db.exec("reset role; alter table professional_service.audit_events drop constraint synthetic_note_audit_fail"); }
  });
  it.each(["anon", "authenticated"])("blocks direct %s RPC access", async (role) => {
    await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.role','service_role',false)`);
    await expect(save()).rejects.toThrow(/permission denied/);
  });
});

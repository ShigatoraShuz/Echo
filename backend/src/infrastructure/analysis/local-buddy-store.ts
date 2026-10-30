import { mkdirSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, fsyncSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { NotFoundError } from "../../shared/errors/app-error.js";
const schema = z.object({ provenance: z.array(z.record(z.string(), z.unknown())).default([]), id: z.string().uuid(), user_id: z.string().uuid(), title: z.string(), preview: z.string(), archived: z.boolean(), pinned_at: z.string().nullable(), last_message_at: z.string().nullable(), created_at: z.string(), supportRequired: z.boolean(), messages: z.array(z.object({ id: z.string(), role: z.enum(['user', 'buddy']), content: z.string(), timestamp: z.string() })) });
export class LocalBuddyStore {
    constructor(readonly root: string) { }
    private dir(user: string) { z.string().uuid().parse(user); const dir = join(this.root, user, 'buddy'); mkdirSync(dir, { recursive: true }); return dir; }
    list(user: string) { return readdirSync(this.dir(user)).filter(x => x.endsWith('.json')).map(x => { const c = schema.parse(JSON.parse(readFileSync(join(this.dir(user), x), 'utf8'))); if (c.user_id !== user)
        throw Error('Local ownership mismatch'); return c; }); }
    get(user: string, id: string) { const c = this.list(user).find(x => x.id === id); if (!c)
        throw new NotFoundError('Local conversation unavailable.'); return c; }
    save(c: z.infer<typeof schema>) { schema.parse(c); const f = join(this.dir(c.user_id), c.id + '.json'), tmp = f + '.tmp'; const fd = openSync(tmp, 'wx'); try {
        writeFileSync(fd, JSON.stringify({ schemaVersion: 1, ...c }, null, 2));
        fsyncSync(fd);
    }
    finally {
        closeSync(fd);
    } renameSync(tmp, f); return c; }
    create(user: string) { return this.save({ id: randomUUID(), user_id: user, title: 'Buddy conversation', preview: '', archived: false, pinned_at: null, last_message_at: null, created_at: new Date().toISOString(), supportRequired: false, messages: [], provenance: [] }); }
    remove(user: string, id: string) { this.get(user, id); unlinkSync(join(this.dir(user), id + '.json')); return { deleted: true }; }
}

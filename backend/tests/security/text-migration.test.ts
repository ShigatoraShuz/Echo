import {describe,it,expect,vi} from "vitest";
import {createEncryptionService,encryptText,decryptText} from "../../src/infrastructure/encryption/encryption.service.js";
import {migrateEncryptedText} from "../../src/infrastructure/encryption/text-migration.js";
const oldKey=Buffer.alloc(32,1).toString("base64"),key=Buffer.alloc(32,2).toString("base64");
const old=createEncryptionService(oldKey,1),current=createEncryptionService(key,2,{"1":oldKey});
function store(content:string) {return {page:vi.fn().mockResolvedValueOnce([{id:"one",user_id:"owner",content}]).mockResolvedValue([]),replace:vi.fn().mockResolvedValue(true)};}
describe("restricted text backfill and rotation",()=>{
 it("defaults to non-mutating coverage",async()=>{const db=store("synthetic text");expect(await migrateEncryptedText(db,current,2)).toMatchObject({needsMigration:1,updated:0});expect(db.replace).not.toHaveBeenCalled();});
 it("encrypts plaintext and rotates old versions without logging content",async()=>{for(const content of ["synthetic text",encryptText("synthetic text",old)]){const db=store(content);expect(await migrateEncryptedText(db,current,2,true)).toMatchObject({updated:1,unreadable:0});const args=db.replace.mock.calls[0];expect(args[1]).toMatch(/^[a-f0-9]{64}$/);expect(args[2]).not.toContain("synthetic text");expect(decryptText(args[2],current)).toBe("synthetic text");}});
 it("is idempotent and reports tampering/conflicts without overwriting",async()=>{const db=store(encryptText("synthetic",current));expect(await migrateEncryptedText(db,current,2,true)).toMatchObject({unchanged:1,updated:0});expect(db.replace).not.toHaveBeenCalled();const bad=store("echo:encrypted:v1:bad");expect(await migrateEncryptedText(bad,current,2,true)).toMatchObject({unreadable:1});expect(bad.replace).not.toHaveBeenCalled();const race=store("synthetic");race.replace.mockResolvedValue(false);expect(await migrateEncryptedText(race,current,2,true)).toMatchObject({conflicts:1,updated:0});});
});

import { createHash } from "node:crypto";
import { decryptText, encryptText, type EncryptionService } from "./encryption.service.js";
export interface TextMigrationRow { id:string; user_id:string; content:string }
export interface TextMigrationStore {
 page(after:string|undefined):Promise<TextMigrationRow[]>;
 replace(row:TextMigrationRow,digest:string,ciphertext:string):Promise<boolean>;
}
/** Dry-run by default; counts only, no plaintext logs or temporary files. */
export async function migrateEncryptedText(store:TextMigrationStore,encryption:EncryptionService,activeVersion:number,apply=false) {
 const result={scanned:0,unchanged:0,needsMigration:0,updated:0,conflicts:0,unreadable:0};
 let cursor:string|undefined;
 for (;;) {
  const rows=await store.page(cursor); if(!rows.length) break;
  for(const row of rows) {
   result.scanned++;
   try {
    const encrypted=row.content.startsWith("echo:encrypted:v1:");
    const plaintext=encrypted ? decryptText(row.content,encryption) : row.content;
    if (encrypted) {
     const payload=JSON.parse(Buffer.from(row.content.slice("echo:encrypted:v1:".length),"base64").toString("utf8")) as {keyVersion:number};
     if(payload.keyVersion===activeVersion){result.unchanged++;continue;}
    }
    result.needsMigration++;
    if(apply) {
     const replacement=encryptText(plaintext,encryption);
     if(decryptText(replacement,encryption)!==plaintext) throw new Error("Round-trip failed");
     const digest=createHash("sha256").update(row.content).digest("hex");
     if(await store.replace(row,digest,replacement)) result.updated++; else result.conflicts++;
    }
   } catch {result.unreadable++;}
  }
  const next=rows.at(-1)!.id;
  if(next===cursor) throw new Error("Migration pagination did not advance.");
  cursor=next;
 }
 return result;
}

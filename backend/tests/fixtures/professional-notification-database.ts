import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { ids, professionalDatabase, seedProfessionalDatabase, serviceRole } from "./professional-database.js";
export async function professionalNotificationDatabase(extras: string[] = []) {
  const db = await professionalDatabase(["20261014110000_professional_claim_lifecycle.sql", "20261015100000_professional_case_snapshot.sql", "20261015110000_professional_consent.sql", "20261015120000_professional_notes.sql", "20261015130000_professional_case_handover.sql", "20261016120000_professional_follow_ups.sql", "20261016130000_professional_referral_lifecycle.sql"]);
  await installNotificationFixture(db);
  for (const migration of ["20261016140000_professional_notifications.sql", ...extras]) {
    await db.exec(await readFile(new URL(`../../../supabase/migrations/${migration}`, import.meta.url), "utf8"));
  }
  return db;
}
export async function installNotificationFixture(db: PGlite) {
  // Execute the actual existing notification table definition, with only the
  // preference fields consumed by this workflow stubbed in the synthetic fixture.
  const base = await readFile(new URL("../../../supabase/migrations/20260824020000_schema_per_service_architecture.sql", import.meta.url), "utf8");
  const table = base.match(/create table if not exists notification_service\.notifications \([\s\S]*?\n\);/)?.[0];
  if (!table) throw new Error("Notification fixture schema was not found.");
  await db.exec(`create schema notification_service; ${table}
    create table user_service.notification_preferences(user_id uuid primary key,in_app_enabled boolean not null default true);`);
}
export async function seedProfessionalNotifications(db: PGlite) {
  await seedProfessionalDatabase(db);
  await db.exec("reset role; truncate notification_service.notifications cascade; truncate user_service.notification_preferences");
  await db.query("insert into user_service.notification_preferences(user_id) values($1),($2),($3)", [ids.actor, ids.second, ids.outsider]);
  await serviceRole(db);
  await db.query("select professional_service.claim_request($1,$2)", [ids.request, ids.actor]);
}

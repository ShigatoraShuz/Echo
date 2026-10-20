import type { SupabaseClient } from "@supabase/supabase-js";
import { AuthorizationError, ExternalServiceError } from "../../shared/errors/app-error.js";

/** Completeness/permission gate; verified-contact delivery retains its stricter existing checks. */
export async function hasValidTrustedContact(database: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await database.schema("user_service").rpc("has_valid_trusted_contact", { p_user_id: userId });
  if (error)
    throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Your trusted support contact could not be checked.");
  return data === true;
}

export async function assertTrustedContact(database: SupabaseClient, userId: string): Promise<void> {
  if (!(await hasValidTrustedContact(database, userId)))
    throw new AuthorizationError(
      "Add a valid Trusted Support Contact and confirm their permission in Settings before using Buddy or AI analysis.",
    );
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { AuthorizationError, ExternalServiceError, NotFoundError } from "../../shared/errors/app-error.js";
function fail(error: { message: string }): never {
  if (error.message === "MEMBERSHIP_REQUIRED") throw new AuthorizationError();
  if (error.message === "REQUEST_NOT_FOUND") throw new NotFoundError("The resource is unavailable.");
  throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Professional notifications are temporarily unavailable.");
}
export class ProfessionalNotificationService {
  constructor(private readonly database: SupabaseClient) {}
  async list(actor: string, organizationId: string, unreadOnly: boolean) {
    const { data, error } = await this.database.schema("professional_service").rpc("list_notifications", { p_actor: actor, p_organization_id: organizationId, p_unread_only: unreadOnly });
    if (error) fail(error);
    return data;
  }
  async read(actor: string, organizationId: string, notificationId: string) {
    const { data, error } = await this.database.schema("professional_service").rpc("read_notification", { p_actor: actor, p_organization_id: organizationId, p_notification_id: notificationId });
    if (error) fail(error);
    return data;
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { ExternalServiceError } from "../../shared/errors/app-error.js";
import { asString } from "../../shared/utils/coerce.js";

type DatabaseRow = Record<string, unknown>;

export class SupportResourcesService {
  constructor(private readonly database: SupabaseClient) {}

  async supportResources(query?: string, type?: string) {
    let builder = this.database
      .from("support_resources")
      .select("*")
      .eq("is_active", true)
      .eq("is_verified", true)
      .order("display_priority", { ascending: true });
    if (type && type !== "all") builder = builder.eq("support_resource_type", type);
    if (query) {
      const safeQuery = query.replace(/[%_,()]/g, " ").trim();
      if (safeQuery) {
        builder = builder.or(
          `organization_name.ilike.%${safeQuery}%,resource_name.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`,
        );
      }
    }
    const { data, error } = await builder;
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Support resources are temporarily unavailable.");
    return ((data ?? []) as DatabaseRow[]).map((row) => ({
      id: asString(row.id),
      type: asString(row.support_resource_type),
      organizationName: asString(row.organization_name),
      name: asString(row.resource_name),
      description: asString(row.description),
      phoneNumber: asString(row.phone_number) || null,
      smsNumber: asString(row.sms_number) || null,
      websiteUrl: asString(row.website_url) || null,
      availability: asString(row.availability_text),
      countryCode: asString(row.country_code),
      regionCode: asString(row.region_code) || null,
      lastVerifiedAt: asString(row.last_verified_at),
    }));
  }
}

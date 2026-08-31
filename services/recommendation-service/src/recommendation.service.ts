import type { OwnedDatabase } from "@echo/service-core";
import { ServiceError } from "@echo/service-core";
import { recommend, type Severity } from "./recommendation.js";

type Row = Record<string, unknown>;

export class RecommendationService {
  constructor(private readonly database: OwnedDatabase) {}

  async create(input: { severity: Severity; urgentLanguageDetected: boolean }) {
    const { data, error } = await this.database
      .from("support_resources")
      .select("id, support_resource_type, organization_name, resource_name, phone_number, sms_number, website_url, availability_text")
      .eq("is_active", true)
      .eq("is_verified", true)
      .order("display_priority", { ascending: true })
      .limit(3);
    if (error) {
      throw new ServiceError(503, "DATABASE_UNAVAILABLE", "Verified support resources are temporarily unavailable.");
    }

    return {
      ...recommend(input),
      supportResources: ((data ?? []) as Row[]).map((row) => ({
        id: String(row.id ?? ""),
        type: String(row.support_resource_type ?? ""),
        organizationName: String(row.organization_name ?? ""),
        name: String(row.resource_name ?? ""),
        phoneNumber: typeof row.phone_number === "string" ? row.phone_number : null,
        smsNumber: typeof row.sms_number === "string" ? row.sms_number : null,
        websiteUrl: typeof row.website_url === "string" ? row.website_url : null,
        availability: String(row.availability_text ?? ""),
      })),
    };
  }
}

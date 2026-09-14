import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ConflictError, ExternalServiceError, NotFoundError, ValidationError } from "../../shared/errors/app-error.js";

export function validateJournalImage(bytes: Buffer, mime: string): void {
  const valid =
    mime === "image/jpeg"
      ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : mime === "image/png"
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : mime === "image/webp"
          ? bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
          : false;

  if (!valid || bytes.length < 12 || bytes.length > 5 * 1024 * 1024) {
    throw new ValidationError({
      image: ["Use a JPEG, PNG, or WebP image no larger than 5 MB."],
    });
  }
}

export class JournalImagesService {
  constructor(private readonly database: SupabaseClient) {}

  private async releaseReservation(userId: string, journalId: string, imageId: string): Promise<void> {
    // Best-effort release. If this database write cannot complete, the
    // reservation's bounded expiry still prevents it from consuming a slot
    // indefinitely.
    await this.database
      .schema("journal_service")
      .from("journal_images")
      .update({
        reservation_expires_at: new Date().toISOString(),
      })
      .eq("id", imageId)
      .eq("user_id", userId)
      .eq("journal_id", journalId)
      .eq("uploaded", false);
  }

  async upload(userId: string, journalId: string, imageId: string, bytes: Buffer, mime: string) {
    validateJournalImage(bytes, mime);

    const { data: path, error } = await this.database.schema("journal_service").rpc("reserve_journal_image", {
      p_user_id: userId,
      p_journal_id: journalId,
      p_image_id: imageId,
      p_hash: createHash("sha256").update(bytes).digest("hex"),
      p_mime_type: mime,
    });

    if (error?.message.includes("JOURNAL_NOT_FOUND")) {
      throw new NotFoundError();
    }

    if (error?.message.includes("IMAGE_LIMIT") || error?.message.includes("IMAGE_CONFLICT")) {
      throw new ConflictError(
        "IMAGE_CONFLICT",
        "This journal supports up to five photos. Retry the original photo or remove it from this submission.",
      );
    }

    if (error || typeof path !== "string") {
      throw new ExternalServiceError(
        "DATABASE_UNAVAILABLE",
        "The photo could not be prepared. Your journal remains saved.",
      );
    }

    const upload = await this.database.storage.from("journal-images").upload(path, bytes, {
      contentType: mime,
      upsert: true,
    });

    if (upload.error) {
      await this.releaseReservation(userId, journalId, imageId);

      throw new ExternalServiceError(
        "STORAGE_UNAVAILABLE",
        "The photo could not be uploaded. Your journal remains saved; retry the photo.",
      );
    }

    const updated = await this.database
      .schema("journal_service")
      .from("journal_images")
      .update({
        uploaded: true,
        reservation_expires_at: null,
      })
      .eq("id", imageId)
      .eq("user_id", userId)
      .eq("journal_id", journalId)
      .eq("uploaded", false)
      .select("id")
      .maybeSingle();

    if (updated.error || !updated.data) {
      // The upload already reached Storage, but the database association
      // could not be finalized. Remove the object where possible and
      // release the reservation so it cannot permanently consume a slot.
      await this.database.storage.from("journal-images").remove([path]);

      await this.releaseReservation(userId, journalId, imageId);

      if (updated.error?.message.includes("IMAGE_LIMIT")) {
        throw new ConflictError(
          "IMAGE_CONFLICT",
          "This journal already has five photos. Remove one before adding another.",
        );
      }

      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The photo could not be attached. Please retry.");
    }

    return {
      id: imageId,
    };
  }

  async list(
    userId: string,
    journalId: string,
  ): Promise<
    Array<{
      id: string;
      url: string;
    }>
  > {
    const { data, error } = await this.database
      .schema("journal_service")
      .from("journal_images")
      .select("id,storage_path")
      .eq("user_id", userId)
      .eq("journal_id", journalId)
      .eq("uploaded", true)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Journal photos could not be loaded.");
    }

    return (
      await Promise.all(
        (data ?? []).map(async (row) => {
          const result = await this.database.storage.from("journal-images").createSignedUrl(row.storage_path, 300);

          return result.data
            ? {
                id: String(row.id),
                url: result.data.signedUrl,
              }
            : null;
        }),
      )
    ).filter(
      (
        item,
      ): item is {
        id: string;
        url: string;
      } => item !== null,
    );
  }

  async cleanup(): Promise<void> {
    const { data, error } = await this.database
      .schema("journal_service")
      .from("image_deletion_queue")
      .select("storage_path")
      .limit(100);

    if (error) {
      throw new ExternalServiceError();
    }

    if (!data?.length) {
      return;
    }

    const paths = data.map((row) => String(row.storage_path));

    const removed = await this.database.storage.from("journal-images").remove(paths);

    if (removed.error) {
      throw new ExternalServiceError();
    }

    const deleted = await this.database
      .schema("journal_service")
      .from("image_deletion_queue")
      .delete()
      .in("storage_path", paths);

    if (deleted.error) {
      throw new ExternalServiceError();
    }
  }
}

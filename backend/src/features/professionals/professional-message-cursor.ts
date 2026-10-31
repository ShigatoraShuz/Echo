import { z } from "zod";

// Keep the original timestamp-only cursor valid for older clients. New pages
// retain PostgreSQL timestamp precision and a UUID tie-breaker, never message text.
export const professionalMessageCursorSchema = z.string().max(128).refine((cursor) => {
  const parts = cursor.split("~");
  return parts.length <= 2 && z.iso.datetime({ offset: true }).safeParse(parts[0]).success &&
    (parts.length === 1 || z.uuid().safeParse(parts[1]).success);
}, "Choose a valid message page cursor.");

export function messageBoundary(cursor: string) {
  const [at, id] = professionalMessageCursorSchema.parse(cursor).split("~");
  return { at, id };
}

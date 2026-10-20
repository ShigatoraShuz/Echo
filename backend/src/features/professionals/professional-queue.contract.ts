import { z } from "zod";

export const professionalQueueQuery = z.strictObject({
  status: z.enum(["submitted", "assigned", "scheduled", "closed", "declined"]).optional(),
  assignedTo: z.union([z.uuid(), z.literal("me"), z.literal("unassigned")]).optional(),
  createdFrom: z.iso.date().optional(), createdThrough: z.iso.date().optional(),
  sort: z.enum(["newest", "oldest", "updated"]).default("newest"),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
}).refine((input) => !input.createdFrom || !input.createdThrough || input.createdFrom <= input.createdThrough, {
  path: ["createdThrough"], message: "The end date must not precede the start date.",
});
export type ProfessionalQueueQuery = z.input<typeof professionalQueueQuery>;

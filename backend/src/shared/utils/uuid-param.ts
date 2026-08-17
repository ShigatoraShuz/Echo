import type { Request } from "express";
import { z } from "zod";
import { ValidationError } from "../errors/app-error.js";

const uuidParamSchema = z.string().uuid();

/**
 * Validates that a path parameter is a well-formed UUID before it reaches
 * database queries. Malformed identifiers previously surfaced as 503 database
 * errors; they are now rejected with a 400.
 */
export function requireUuidParam(request: Request, name: string): string {
  const value = request.params[name];
  if (typeof value !== "string" || !uuidParamSchema.safeParse(value).success) {
    throw new ValidationError({ [name]: [`${name} must be a valid UUID.`] });
  }
  return value;
}

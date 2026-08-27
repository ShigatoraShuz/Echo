import type { Request } from "express";
import { z } from "zod";
import { ValidationError } from "../errors/app-error.js";
export function requireUuidParam(request: Request, name: string): string { const value = request.params[name]; if (typeof value !== "string" || !z.string().uuid().safeParse(value).success) throw new ValidationError({ [name]: [`${name} must be a valid UUID.`] }); return value; }

import type { NextFunction, Request, Response } from "express";
import { AuthenticationError } from "../errors/app-error.js";

interface AiAccessPolicy {
  assertAiAccess(userId: string): Promise<void>;
}

export function createVerifiedAiAccessMiddleware(service: AiAccessPolicy) {
  return async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    try {
      if (!request.auth) throw new AuthenticationError();
      await service.assertAiAccess(request.auth.id);
      next();
    } catch (error) {
      next(error);
    }
  };
}

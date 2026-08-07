import type { NextFunction, Request, Response } from "express";
import { AuthenticationError } from "../../shared/errors/app-error.js";
import type { VerificationService } from "./verification.service.js";

export function createVerifiedAiAccessMiddleware(service: VerificationService) {
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

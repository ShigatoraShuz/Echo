import { Router, type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import type { RegistrationService, DraftCredentials } from "./registration.service.js";
import { ValidationError } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/utils/response.js";

const COOKIE_PATH = "/api/v1/registration";
const limiter = rateLimit({ windowMs: 60_000, limit: 12, standardHeaders: "draft-8", legacyHeaders: false });

function cookies(request: Request): Record<string, string> {
  return Object.fromEntries(
    (request.headers.cookie ?? "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)]),
  );
}
function credentials(request: Request) {
  const values = cookies(request);
  return { token: values.echo_signup_draft ?? "", csrf: request.header("x-echo-csrf") ?? "" };
}
function setCredentials(response: Response, value: DraftCredentials): void {
  const security = `SameSite=Lax; Secure; Max-Age=1800`;
  response.append(
    "Set-Cookie",
    `echo_signup_draft=${encodeURIComponent(value.token)}; Path=${COOKIE_PATH}; ${security}; HttpOnly`,
  );
  response.append("Set-Cookie", `echo_signup_csrf=${encodeURIComponent(value.csrf)}; Path=/; ${security}`);
}
function validateOrigin(allowedOrigin: string) {
  const allowed = new Set([
    allowedOrigin,
    allowedOrigin.replace("localhost", "127.0.0.1"),
    allowedOrigin.replace("127.0.0.1", "localhost"),
  ]);
  return (request: Request, _response: Response, next: NextFunction) => {
    const origin = request.header("origin");
    if (request.method !== "GET" && (!origin || !allowed.has(origin)))
      return next(new ValidationError({ origin: ["Untrusted request origin."] }));
    next();
  };
}
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError({ fields: result.error.flatten().fieldErrors });
  return result.data;
}

export function createRegistrationRouter(service: RegistrationService, allowedOrigin: string): Router {
  const router = Router();
  router.use("/registration", limiter, validateOrigin(allowedOrigin));
  router.get("/registration/policies", async (_request, response, next) => {
    try {
      sendSuccess(response, await service.activePolicies());
    } catch (error) {
      next(error);
    }
  });
  router.post("/registration/eligibility", async (request, response, next) => {
    try {
      const input = parse(z.object({ birthday: z.string() }), request.body);
      const result = await service.startEligibility(input.birthday);
      if (result.credentials) setCredentials(response, result.credentials);
      sendSuccess(response, { eligible: result.eligible, ruleVersion: "echo-adult-18-v1" });
    } catch (error) {
      next(error);
    }
  });
  router.post("/registration/agreements", async (request, response, next) => {
    try {
      const input = parse(
        z.object({
          reviewedDocumentIds: z.array(z.string().uuid()).length(3),
          termsAccepted: z.literal(true),
          privacyAccepted: z.literal(true),
          aiNoticeAccepted: z.literal(true),
          optionalAiAnalysis: z.boolean(),
        }),
        request.body,
      );
      const auth = credentials(request);
      const nextCredentials = await service.acceptAgreements(auth.token, auth.csrf, input);
      setCredentials(response, nextCredentials);
      sendSuccess(response, { nextStep: "account" });
    } catch (error) {
      next(error);
    }
  });
  router.post("/registration/email", async (request, response, next) => {
    try {
      const input = parse(
        z
          .object({ email: z.string().email(), password: z.string(), confirmPassword: z.string() })
          .refine((v) => v.password === v.confirmPassword, {
            path: ["confirmPassword"],
            message: "Passwords do not match.",
          }),
        request.body,
      );
      const auth = credentials(request);
      const nextCredentials = await service.registerEmail(auth.token, auth.csrf, input.email, input.password);
      setCredentials(response, nextCredentials);
      sendSuccess(response, { nextStep: "verify", verificationPending: true }, 201);
    } catch (error) {
      next(error);
    }
  });
  router.get("/registration/status", async (request, response, next) => {
    try {
      sendSuccess(response, await service.registrationStatus(cookies(request).echo_signup_draft ?? ""));
    } catch (error) {
      next(error);
    }
  });
  router.post("/registration/resend", async (request, response, next) => {
    try {
      const auth = credentials(request);
      await service.resendVerification(auth.token, auth.csrf);
      sendSuccess(response, { sent: true });
    } catch (error) {
      next(error);
    }
  });
  router.post("/registration/google/nonce", async (request, response, next) => {
    try {
      const auth = credentials(request);
      const result = await service.createGoogleNonce(auth.token, auth.csrf);
      setCredentials(response, result.credentials);
      sendSuccess(response, { nonce: result.nonce, hashedNonce: result.hashedNonce });
    } catch (error) {
      next(error);
    }
  });
  router.post("/registration/google/bind", async (request, response, next) => {
    try {
      const input = parse(z.object({ idToken: z.string().min(100), nonce: z.string().min(16) }), request.body);
      const auth = credentials(request);
      const result = await service.bindGoogleSignup(auth.token, auth.csrf, input.idToken, input.nonce);
      setCredentials(response, result.credentials);
      sendSuccess(response, { reservation: result.reservation, email: result.identity.email });
    } catch (error) {
      next(error);
    }
  });
  router.post("/registration/google/login-status", async (request, response, next) => {
    try {
      const input = parse(z.object({ idToken: z.string().min(100), nonce: z.string().min(16) }), request.body);
      service.verifyGoogleLoginProof(cookies(request).echo_google_login ?? "", input.nonce);
      sendSuccess(response, await service.googleLoginStatus(input.idToken, input.nonce));
    } catch (error) {
      next(error);
    }
  });
  router.post("/registration/google/login-nonce", async (_request, response, next) => {
    try {
      const value = service.createGoogleLoginNonce();
      response.append(
        "Set-Cookie",
        `echo_google_login=${encodeURIComponent(value.proof)}; Path=${COOKIE_PATH}; SameSite=Lax; Secure; HttpOnly; Max-Age=300`,
      );
      sendSuccess(response, { nonce: value.nonce, hashedNonce: value.hashedNonce });
    } catch (error) {
      next(error);
    }
  });
  return router;
}

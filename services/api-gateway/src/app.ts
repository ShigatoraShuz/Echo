import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import cors from "cors";
import express, { type Request } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { gatewayUserHeaders, ServiceError } from "@echo/service-core";
import type { GatewayConfig } from "./config.js";

type User = { id: string };
type TokenVerifier = (token: string) => Promise<User | null>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ServiceUrlKey = keyof Pick<GatewayConfig,
  "USER_SERVICE_URL" | "JOURNAL_SERVICE_URL" | "ASSESSMENT_SERVICE_URL" | "ANALYSIS_SERVICE_URL" |
  "RECOMMENDATION_SERVICE_URL" | "WELLNESS_SERVICE_URL" | "INSIGHTS_SERVICE_URL">;
type ServiceTokenKey = keyof Pick<GatewayConfig,
  "USER_SERVICE_TOKEN" | "JOURNAL_SERVICE_TOKEN" | "ASSESSMENT_SERVICE_TOKEN" | "ANALYSIS_SERVICE_TOKEN" |
  "RECOMMENDATION_SERVICE_TOKEN" | "WELLNESS_SERVICE_TOKEN" | "INSIGHTS_SERVICE_TOKEN">;
const routeTable: Array<[RegExp, ServiceUrlKey, ServiceTokenKey]> = [
  [/^\/journals\/[^/]+\/(analyze|analyses)(?:\/|$)/, "ANALYSIS_SERVICE_URL", "ANALYSIS_SERVICE_TOKEN"],
  [/^\/(settings|onboarding|verification|admin)(?:\/|$)/, "USER_SERVICE_URL", "USER_SERVICE_TOKEN"],
  [/^\/journals(?:\/|$)/, "JOURNAL_SERVICE_URL", "JOURNAL_SERVICE_TOKEN"],
  [/^\/(assessments|moods)(?:\/|$)/, "ASSESSMENT_SERVICE_URL", "ASSESSMENT_SERVICE_TOKEN"],
  [/^\/recommendations(?:\/|$)/, "RECOMMENDATION_SERVICE_URL", "RECOMMENDATION_SERVICE_TOKEN"],
  [/^\/(buddy|grounding|support-resources)(?:\/|$)/, "WELLNESS_SERVICE_URL", "WELLNESS_SERVICE_TOKEN"],
  [/^\/(dashboard|insights)(?:\/|$)/, "INSIGHTS_SERVICE_URL", "INSIGHTS_SERVICE_TOKEN"],
];

function publicRoute(request: Request): boolean {
  return request.method === "GET" && request.path.startsWith("/support-resources");
}

async function rawRequestBody(request: Request): Promise<Buffer | undefined> {
  if (Buffer.isBuffer(request.body)) return request.body;
  if (request.body !== undefined) return Buffer.from(JSON.stringify(request.body));
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export function createGatewayApp(config: GatewayConfig, verifier?: TokenVerifier) {
  const authClient = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const verify = verifier ?? (async (token: string) => {
    const { data, error } = await authClient.auth.getUser(token);
    return error || !data.user ? null : { id: data.user.id };
  });
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: config.FRONTEND_URL, credentials: true }));
  app.use((request, response, next) => {
    const incoming = request.header("x-request-id");
    request.requestId = incoming && UUID.test(incoming) ? incoming : randomUUID();
    response.setHeader("x-request-id", request.requestId);
    response.setHeader("cache-control", "no-store");
    next();
  });
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }));
  app.use("/api/v1/settings/avatar", express.raw({
    type: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    limit: "5mb",
  }));
  app.use("/api/v1/verification/documents", express.raw({
    type: ["image/jpeg", "image/png", "application/pdf"],
    limit: "8mb",
  }));
  app.use(express.json({ limit: "1mb", type: ["application/json", "application/*+json"] }));
  app.get("/api/v1/health", (_request, response) => response.json({ status: "ok", service: "api-gateway" }));

  app.use("/api/v1", async (request, response, next) => {
    try {
      const match = routeTable.find(([pattern]) => pattern.test(request.path));
      if (!match) throw new ServiceError(404, "ROUTE_NOT_FOUND", "The requested API route does not exist.");
      let user: User | null = null;
      if (!publicRoute(request)) {
        const authorization = request.header("authorization") ?? "";
        const [scheme, token] = authorization.split(" ", 2);
        if (scheme?.toLowerCase() !== "bearer" || !token) throw new ServiceError(401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
        try { user = await verify(token); } catch { user = null; }
        if (!user) throw new ServiceError(401, "INVALID_ACCESS_TOKEN", "Your session is invalid or expired.");
      }
      const upstream = config[match[1]].replace(/\/$/, "");
      const headers = new Headers();
      for (const name of ["content-type", "accept"]) {
        const value = request.header(name);
        if (value) headers.set(name, value);
      }
      headers.set("x-request-id", request.requestId);
      if (user) {
        for (const [name, value] of Object.entries(gatewayUserHeaders({ requestId: request.requestId, userId: user.id, secret: config[match[2]] }))) headers.set(name, value);
      }
      const body = ["GET", "HEAD"].includes(request.method) ? undefined : await rawRequestBody(request);
      let upstreamResponse: globalThis.Response;
      try {
        upstreamResponse = await fetch(`${upstream}/api/v1${request.url}`, {
          method: request.method,
          headers,
          body: body as unknown as BodyInit | undefined,
          signal: AbortSignal.timeout(config.REQUEST_TIMEOUT_MS),
        });
      } catch (error) {
        const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
        throw new ServiceError(timeout ? 504 : 503, timeout ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE", timeout ? "The requested service timed out." : "The requested service is unavailable.");
      }
      const contentType = upstreamResponse.headers.get("content-type");
      const responseBody = Buffer.from(await upstreamResponse.arrayBuffer());
      if (contentType) response.setHeader("content-type", contentType);
      response.status(upstreamResponse.status).send(responseBody);
    } catch (error) { next(error); }
  });
  app.use((error: unknown, request: Request, response: express.Response, _next: express.NextFunction) => {
    const parserStatus = typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : undefined;
    const known = error instanceof ServiceError
      ? error
      : parserStatus === 413
        ? new ServiceError(413, "PAYLOAD_TOO_LARGE", "The uploaded file is too large.")
        : parserStatus === 400
          ? new ServiceError(400, "INVALID_REQUEST_BODY", "The request body is invalid.")
          : new ServiceError(500, "INTERNAL_SERVER_ERROR", "Something went wrong. Please try again later.");
    response.status(known.statusCode).json({ success: false, error: { code: known.code, message: known.message }, meta: { requestId: request.requestId } });
  });
  return app;
}

import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ServiceError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = "ServiceError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function env(name, fallback) {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

export function positiveIntegerEnv(name, fallback) {
  const value = Number(env(name, String(fallback)));
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`);
  return value;
}

export function secretEnv(name, minimumLength = 32) {
  const value = env(name);
  if (value.length < minimumLength) throw new Error(`${name} must contain at least ${minimumLength} characters.`);
  return value;
}

export function createAesGcmEncryption(keyBase64, keyVersion) {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) throw new Error("The encryption key must decode to 32 bytes.");
  if (!Number.isInteger(keyVersion) || keyVersion <= 0) throw new Error("The encryption key version must be a positive integer.");
  return {
    encrypt(plaintext) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      return {
        ciphertext: Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]).toString("base64"),
        iv: iv.toString("base64"),
        authenticationTag: cipher.getAuthTag().toString("base64"),
        keyVersion,
      };
    },
    decrypt(payload) {
      if (payload.keyVersion !== keyVersion) throw new Error("Unsupported encryption key version.");
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
      decipher.setAuthTag(Buffer.from(payload.authenticationTag, "base64"));
      return Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, "base64")), decipher.final()]).toString("utf8");
    },
  };
}

export function createOwnedDatabase({ url, key, tables, functions = [] }) {
  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "public" },
  });
  const owned = new Set(tables);
  const callable = new Set(functions);
  return {
    from(table) {
      if (!owned.has(table)) {
        throw new ServiceError(500, "DATABASE_OWNERSHIP_VIOLATION", `This service does not own table ${table}.`);
      }
      return client.from(table);
    },
    rpc(functionName, args) {
      if (!callable.has(functionName)) {
        throw new ServiceError(500, "DATABASE_OWNERSHIP_VIOLATION", `This service cannot call function ${functionName}.`);
      }
      return client.rpc(functionName, args);
    },
    storage: client.storage,
  };
}

export function createAuthClient(url, publishableKey) {
  return createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "public" },
  });
}

function signaturePayload(requestId, userId, timestamp) {
  return `${requestId}\n${userId}\n${timestamp}`;
}

export function signUserContext({ requestId, userId, timestamp, secret }) {
  return createHmac("sha256", secret).update(signaturePayload(requestId, userId, timestamp)).digest("hex");
}

export function gatewayUserHeaders({ requestId, userId, secret }) {
  const timestamp = String(Date.now());
  return {
    "x-request-id": requestId,
    "x-echo-user": userId,
    "x-echo-timestamp": timestamp,
    "x-echo-signature": signUserContext({ requestId, userId, timestamp, secret }),
  };
}

export function requireGatewayUser(secret, maxAgeMs = 60_000) {
  return (request, _response, next) => {
    try {
      const userId = request.header("x-echo-user");
      const timestamp = request.header("x-echo-timestamp");
      const supplied = request.header("x-echo-signature");
      const requestId = request.requestId;
      const age = Math.abs(Date.now() - Number(timestamp));
      if (!userId || !UUID.test(userId) || !timestamp || !Number.isFinite(age) || age > maxAgeMs || !supplied) {
        throw new ServiceError(401, "INVALID_INTERNAL_IDENTITY", "Authenticated gateway identity is required.");
      }
      const expected = signUserContext({ requestId, userId, timestamp, secret });
      const suppliedBytes = Buffer.from(supplied, "hex");
      const expectedBytes = Buffer.from(expected, "hex");
      if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) {
        throw new ServiceError(401, "INVALID_INTERNAL_IDENTITY", "Authenticated gateway identity is required.");
      }
      request.auth = { id: userId };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireInternalToken(secret) {
  return (request, _response, next) => {
    const authorization = request.header("authorization") ?? "";
    const [scheme, token] = authorization.split(" ", 2);
    const actual = Buffer.from(token ?? "");
    const expected = Buffer.from(secret);
    if (scheme?.toLowerCase() !== "bearer" || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return next(new ServiceError(401, "INVALID_INTERNAL_TOKEN", "Valid service authentication is required."));
    }
    next();
  };
}

export function createInternalClient({ baseUrl, token, timeoutMs, serviceName }) {
  const root = baseUrl.replace(/\/$/, "");
  return async function request(path, options = {}) {
    const headers = new Headers(options.headers);
    headers.set("authorization", `Bearer ${token}`);
    headers.set("accept", "application/json");
    if (options.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
    let response;
    try {
      response = await fetch(`${root}${path}`, {
        ...options,
        headers,
        body: options.body === undefined || typeof options.body === "string" ? options.body : JSON.stringify(options.body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      throw new ServiceError(
        timedOut ? 504 : 503,
        timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE",
        `${serviceName} is ${timedOut ? "taking too long to respond" : "unavailable"}.`,
      );
    }
    const text = await response.text();
    let body = null;
    if (text) {
      try { body = JSON.parse(text); } catch { throw new ServiceError(502, "UPSTREAM_INVALID_RESPONSE", `${serviceName} returned invalid JSON.`); }
    }
    if (!response.ok) {
      throw new ServiceError(response.status, body?.error?.code ?? "UPSTREAM_ERROR", body?.error?.message ?? `${serviceName} rejected the request.`);
    }
    return body;
  };
}

export function sendData(response, data, requestId, statusCode = 200) {
  response.status(statusCode).json({ success: true, data, meta: { requestId } });
}

export function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

export function createServiceApp({ name, router, allowedOrigin, bodyLimit = "1mb" }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: allowedOrigin || false, credentials: true }));
  app.use((request, response, next) => {
    const incoming = request.header("x-request-id");
    request.requestId = incoming && UUID.test(incoming) ? incoming : randomUUID();
    response.setHeader("x-request-id", request.requestId);
    response.setHeader("cache-control", "no-store");
    next();
  });
  app.use(express.json({ limit: bodyLimit }));
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }));
  app.get("/health", (_request, response) => response.json({ status: "ok", service: name }));
  app.get("/health/ready", (_request, response) => response.json({ status: "ready", service: name }));
  app.use("/api/v1", router);
  app.use((request, _response, next) => next(new ServiceError(404, "NOT_FOUND", `No route for ${request.method} ${request.path}.`)));
  app.use((error, request, response, _next) => {
    const serviceError = error instanceof ServiceError
      ? error
      : new ServiceError(500, "INTERNAL_SERVER_ERROR", "Something went wrong. Please try again later.");
    console.error(JSON.stringify({ service: name, requestId: request.requestId, code: serviceError.code, status: serviceError.statusCode }));
    response.status(serviceError.statusCode).json({
      success: false,
      error: { code: serviceError.code, message: serviceError.message, ...(serviceError.details ? { details: serviceError.details } : {}) },
      meta: { requestId: request.requestId },
    });
  });
  return app;
}

export function listen(app, { name, port }) {
  const server = app.listen(port, () => console.info(JSON.stringify({ service: name, event: "started", port })));
  const shutdown = (signal) => server.close((error) => {
    console.info(JSON.stringify({ service: name, event: "shutdown", signal }));
    process.exitCode = error ? 1 : 0;
  });
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  return server;
}

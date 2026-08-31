import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { ConflictError, ValidationError } from "../../shared/errors/app-error.js";

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export interface IdempotencyIdentity {
  keyVersion: string;
  keyHmac: string;
  requestHash: string;
}

export class IdempotencyService {
  constructor(
    private readonly activeVersion: string,
    private readonly keys: Record<string, string>,
  ) {}
  acceptsVersion(version: string): boolean {
    return Object.hasOwn(this.keys, version);
  }

  identify(rawKey: string | undefined, request: unknown): IdempotencyIdentity {
    if (!rawKey || rawKey.length < 16 || rawKey.length > 200) {
      throw new ValidationError({ idempotencyKey: ["A 16–200 character Idempotency-Key header is required."] });
    }
    const secret = this.keys[this.activeVersion];
    if (!secret) throw new Error("The active idempotency key is unavailable.");
    return {
      keyVersion: this.activeVersion,
      keyHmac: createHmac("sha256", secret).update(rawKey).digest("hex"),
      requestHash: createHash("sha256").update(canonicalize(request)).digest("hex"),
    };
  }

  matches(rawKey: string, version: string, digest: string): boolean {
    const secret = this.keys[version];
    if (!secret) return false;
    const actual = Buffer.from(createHmac("sha256", secret).update(rawKey).digest("hex"));
    const expected = Buffer.from(digest);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  assertSameRequest(existingHash: string, requestHash: string): void {
    if (existingHash !== requestHash)
      throw new ConflictError(
        "IDEMPOTENCY_CONFLICT",
        "This idempotency key was already used for a different journal request.",
      );
  }
}

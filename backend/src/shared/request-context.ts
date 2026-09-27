import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  requestId: string;
  accessToken?: string;
}

const requestContext = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
  return requestContext.run(context, callback);
}

export function currentRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
export function setVerifiedAccessToken(accessToken: string): void {
  const context = requestContext.getStore();
  if (context) context.accessToken = accessToken;
}
export function currentAccessToken(): string {
  const token = requestContext.getStore()?.accessToken;
  if (!token) throw new Error("A verified request identity is required.");
  return token;
}

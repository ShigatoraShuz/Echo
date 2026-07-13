import type { AppError } from "@/shared/errors/app-error";

export type AsyncState<T> =
  | { status: "idle"; data: null; error: null }
  | { status: "loading"; data: null; error: null }
  | { status: "loading-more"; data: T; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "empty"; data: null; error: null }
  | { status: "error"; data: null; error: AppError };

export function createIdle<T>(): AsyncState<T> {
  return { status: "idle", data: null, error: null };
}

export function createLoading<T>(): AsyncState<T> {
  return { status: "loading", data: null, error: null };
}

export function createSuccess<T>(data: T): AsyncState<T> {
  return { status: "success", data, error: null };
}

export function createEmpty<T>(): AsyncState<T> {
  return { status: "empty", data: null, error: null };
}

export function createError<T>(error: AppError): AsyncState<T> {
  return { status: "error", data: null, error };
}

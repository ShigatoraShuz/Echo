import type { AppError } from "@/shared/errors/app-error";

export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: AppError };

export function successResult<T>(data: T): ServiceResult<T> {
  return { success: true, data };
}

export function failureResult<T>(error: AppError): ServiceResult<T> {
  return { success: false, error };
}

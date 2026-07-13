import type { ErrorCode } from "@/shared/errors/error-codes";

export interface FieldError {
  field: string;
  message: string;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly userMessage: string;
  public readonly developerMessage: string | undefined;
  public readonly statusCode: number | undefined;
  public readonly fieldErrors: FieldError[] | undefined;
  public readonly retryable: boolean;
  public readonly cause: unknown;
  public readonly requestId: string | undefined;
  public readonly metadata: Record<string, unknown> | undefined;

  constructor(options: {
    code: ErrorCode;
    userMessage: string;
    developerMessage?: string;
    statusCode?: number;
    fieldErrors?: FieldError[];
    retryable?: boolean;
    cause?: unknown;
    requestId?: string;
    metadata?: Record<string, unknown>;
  }) {
    super(options.userMessage);
    this.name = "AppError";
    this.code = options.code;
    this.userMessage = options.userMessage;
    this.developerMessage = options.developerMessage;
    this.statusCode = options.statusCode;
    this.fieldErrors = options.fieldErrors;
    this.retryable = options.retryable ?? false;
    this.cause = options.cause;
    this.requestId = options.requestId;
    this.metadata = options.metadata;
  }

  get isClientError(): boolean {
    return this.statusCode !== undefined && this.statusCode >= 400 && this.statusCode < 500;
  }

  get isServerError(): boolean {
    return this.statusCode !== undefined && this.statusCode >= 500;
  }
}

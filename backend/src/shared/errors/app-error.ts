export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly logLevel: "warn" | "error";

  constructor(options: {
    statusCode: number;
    code: string;
    message: string;
    details?: Record<string, unknown>;
    logLevel?: "warn" | "error";
  }) {
    super(options.message);
    this.name = "AppError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;
    this.logLevel = options.logLevel ?? (options.statusCode >= 500 ? "error" : "warn");
  }
}

export class AuthenticationError extends AppError {
  constructor(code = "AUTHENTICATION_REQUIRED", message = "Authentication is required.") {
    super({ statusCode: 401, code, message });
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "You do not have permission to access this resource.") {
    super({ statusCode: 403, code: "RESOURCE_FORBIDDEN", message });
  }
}

export class AnalysisGateError extends AppError {
  constructor(message: string, gate = "current_eligibility") {
    super({
      statusCode: 403,
      code: "ANALYSIS_GATE_FAILED",
      message,
      details: { gate, journalSaved: false, draftPreserved: true, privateSaveRequiresExplicitResubmission: true },
    });
  }
}

export class VerificationRequiredError extends AppError {
  constructor(status: string) {
    super({
      statusCode: 403,
      code: "VERIFICATION_REQUIRED",
      message: "Admin-approved account verification is required for Buddy and AI features.",
      details: {
        verificationStatus: status,
        verificationPath: "/settings/verification",
      },
    });
  }
}

export class ValidationError extends AppError {
  constructor(details?: Record<string, unknown>) {
    super({ statusCode: 400, code: "VALIDATION_ERROR", message: "The request is invalid.", details });
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "The request body is too large.") {
    super({ statusCode: 413, code: "PAYLOAD_TOO_LARGE", message });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found.") {
    super({ statusCode: 404, code: "NOT_FOUND", message });
  }
}

export class ConflictError extends AppError {
  constructor(code = "RESOURCE_CONFLICT", message = "This resource cannot be changed in its current state.") {
    super({ statusCode: 409, code, message });
  }
}

export class ExternalServiceError extends AppError {
  constructor(code = "AI_SERVICE_UNAVAILABLE", message = "A dependent service is currently unavailable.") {
    super({ statusCode: 503, code, message });
  }
}

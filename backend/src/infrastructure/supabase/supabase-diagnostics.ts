import { currentRequestId } from "../../shared/request-context.js";
import { redact } from "../../shared/utils/redaction.js";

export interface SupabaseOperation {
  module: string;
  schema: string;
  table: string;
  operation: string;
}

interface SupabaseDiagnosticError {
  code?: unknown;
  message?: unknown;
  status?: unknown;
}

function statusFrom(error: SupabaseDiagnosticError): unknown {
  return error.status;
}

export function logSupabaseError(operation: SupabaseOperation, error: SupabaseDiagnosticError): void {
  console.error(JSON.stringify(redact({
    requestId: currentRequestId() ?? "unscoped",
    service: "backend",
    event: "supabase_query_failed",
    module: operation.module,
    schema: operation.schema,
    table: operation.table,
    operation: operation.operation,
    supabaseCode: error.code,
    message: error.message,
    status: statusFrom(error),
  })));
}

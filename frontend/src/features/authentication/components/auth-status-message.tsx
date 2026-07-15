import type { FormStatus } from "../view-model/use-login-view-model";
import type { AuthServiceError } from "../model/auth.model";
import { EchoInlineMessage } from "@/shared/components/feedback/echo-inline-message";

interface AuthStatusMessageProps {
  status: FormStatus;
  error: AuthServiceError | null;
}

export function AuthStatusMessage({ status, error }: AuthStatusMessageProps) {
  if (status === "success") {
    return (
      <EchoInlineMessage
        variant="success"
        message="Operation completed successfully."
      />
    );
  }

  if (status === "error" && error && !error.fieldErrors) {
    return (
      <EchoInlineMessage
        variant="error"
        message={error.message}
      />
    );
  }

  return null;
}

import { EchoLoadingState } from "./echo-loading-state";

interface LoadingStateProps {
  label?: string;
}

export function LoadingState({
  label = "Loading your ECHO space",
}: LoadingStateProps) {
  return (
    <EchoLoadingState
      variant="page"
      label={label}
    />
  );
}
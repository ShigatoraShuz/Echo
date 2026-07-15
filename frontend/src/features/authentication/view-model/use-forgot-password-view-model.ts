"use client";

import { useCallback, useReducer } from "react";
import type { AuthServiceError } from "../model/auth.model";
import { validateForgotPasswordInput } from "../model/auth.schema";
import { getAuthService } from "../services/auth-service.factory";

export type FormStatus = "idle" | "submitting" | "success" | "error";

interface ForgotPasswordState {
  email: string;
  status: FormStatus;
  error: AuthServiceError | null;
  fieldErrors: Record<string, string[]>;
  successMessage: string | null;
}

type ForgotPasswordAction =
  | { type: "SET_EMAIL"; email: string }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS"; message: string }
  | { type: "SUBMIT_ERROR"; error: AuthServiceError }
  | { type: "SET_FIELD_ERRORS"; fieldErrors: Record<string, string[]> }
  | { type: "RESET" };

function reducer(state: ForgotPasswordState, action: ForgotPasswordAction): ForgotPasswordState {
  switch (action.type) {
    case "SET_EMAIL": return { ...state, email: action.email, error: null, fieldErrors: {} };
    case "SUBMIT_START": return { ...state, status: "submitting", error: null, fieldErrors: {} };
    case "SUBMIT_SUCCESS": return { ...state, status: "success", successMessage: action.message };
    case "SUBMIT_ERROR": return { ...state, status: "error", error: action.error };
    case "SET_FIELD_ERRORS": return { ...state, status: "idle", fieldErrors: action.fieldErrors };
    case "RESET": return { ...initialState };
    default: return state;
  }
}

const initialState: ForgotPasswordState = {
  email: "",
  status: "idle",
  error: null,
  fieldErrors: {},
  successMessage: null,
};

export function useForgotPasswordViewModel() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const authService = getAuthService();

  const setEmail = useCallback((email: string) => dispatch({ type: "SET_EMAIL", email }), []);

  const submit = useCallback(async () => {
    const validation = validateForgotPasswordInput({ email: state.email });
    if (!validation.valid) {
      dispatch({ type: "SET_FIELD_ERRORS", fieldErrors: validation.errors });
      return;
    }

    dispatch({ type: "SUBMIT_START" });
    const result = await authService.forgotPassword({ email: state.email.trim() });
    if (result.success) {
      dispatch({ type: "SUBMIT_SUCCESS", message: result.data.message });
    } else {
      dispatch({ type: "SUBMIT_ERROR", error: result.error });
    }
  }, [state.email, authService]);

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    email: state.email,
    status: state.status,
    error: state.error,
    fieldErrors: state.fieldErrors,
    successMessage: state.successMessage,
    setEmail,
    submit,
    reset,
  };
}

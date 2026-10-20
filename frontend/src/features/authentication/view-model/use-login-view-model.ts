"use client";

import { useCallback, useReducer, useRef } from "react";
import type { AuthServiceError } from "../model/auth.model";
import { validateLoginInput } from "../model/auth.schema";
import { getAuthService } from "@/services/authentication/auth-service.factory";

export type FormStatus = "idle" | "submitting" | "success" | "error";

interface LoginState {
  email: string;
  password: string;
  rememberSession: boolean;
  showPassword: boolean;
  status: FormStatus;
  error: AuthServiceError | null;
  fieldErrors: Record<string, string[]>;
}

type LoginAction =
  | { type: "SET_EMAIL"; email: string }
  | { type: "SET_PASSWORD"; password: string }
  | { type: "SET_REMEMBER_SESSION"; rememberSession: boolean }
  | { type: "TOGGLE_PASSWORD_VISIBILITY" }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS" }
  | { type: "SUBMIT_ERROR"; error: AuthServiceError }
  | { type: "SET_FIELD_ERRORS"; fieldErrors: Record<string, string[]> }
  | { type: "RESET" };

function loginReducer(state: LoginState, action: LoginAction): LoginState {
  switch (action.type) {
    case "SET_EMAIL": return { ...state, email: action.email, error: null, fieldErrors: {} };
    case "SET_PASSWORD": return { ...state, password: action.password, error: null, fieldErrors: {} };
    case "SET_REMEMBER_SESSION": return { ...state, rememberSession: action.rememberSession };
    case "TOGGLE_PASSWORD_VISIBILITY": return { ...state, showPassword: !state.showPassword };
    case "SUBMIT_START": return { ...state, status: "submitting", error: null, fieldErrors: {} };
    case "SUBMIT_SUCCESS": return { ...state, status: "success" };
    case "SUBMIT_ERROR": return { ...state, status: "error", error: action.error };
    case "SET_FIELD_ERRORS": return { ...state, status: "idle", fieldErrors: action.fieldErrors };
    case "RESET": return { ...initialLoginState };
    default: return state;
  }
}

const initialLoginState: LoginState = {
  email: "",
  password: "",
  rememberSession: false,
  showPassword: false,
  status: "idle",
  error: null,
  fieldErrors: {},
};

export function useLoginViewModel() {
  const [state, dispatch] = useReducer(loginReducer, initialLoginState);
  const submitting = useRef(false);
  const authService = getAuthService();

  const setEmail = useCallback((email: string) => dispatch({ type: "SET_EMAIL", email }), []);
  const setPassword = useCallback((password: string) => dispatch({ type: "SET_PASSWORD", password }), []);
  const setRememberSession = useCallback((rememberSession: boolean) => dispatch({ type: "SET_REMEMBER_SESSION", rememberSession }), []);
  const togglePasswordVisibility = useCallback(() => dispatch({ type: "TOGGLE_PASSWORD_VISIBILITY" }), []);

  const submit = useCallback(async () => {
    if (submitting.current) return null;
    const validation = validateLoginInput({
      email: state.email,
      password: state.password,
      rememberSession: state.rememberSession,
    });
    if (!validation.valid) {
      dispatch({ type: "SET_FIELD_ERRORS", fieldErrors: validation.errors });
      return;
    }

    submitting.current = true;
    dispatch({ type: "SUBMIT_START" });
    try {
      const result = await authService.login({
        email: state.email.trim(),
        password: state.password,
        rememberSession: state.rememberSession,
      });
      if (result.success) {
        dispatch({ type: "SUBMIT_SUCCESS" });
        return result.data;
      }
      dispatch({ type: "SUBMIT_ERROR", error: result.error });
      return null;
    } catch {
      dispatch({ type: "SUBMIT_ERROR", error: { code: "NETWORK", message: "Sign-in could not be reached. Check your connection and try again." } });
      return null;
    } finally {
      submitting.current = false;
    }
  }, [state.email, state.password, state.rememberSession, authService]);

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    email: state.email,
    password: state.password,
    rememberSession: state.rememberSession,
    showPassword: state.showPassword,
    status: state.status,
    error: state.error,
    fieldErrors: state.fieldErrors,
    setEmail,
    setPassword,
    setRememberSession,
    togglePasswordVisibility,
    submit,
    reset,
  };
}

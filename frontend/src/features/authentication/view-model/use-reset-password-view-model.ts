"use client";

import { useCallback, useReducer, useEffect, useMemo } from "react";
import type { AuthServiceError } from "../model/auth.model";
import { validateResetPasswordInput } from "../model/auth.schema";
import { getAuthService } from "../services/auth-service.factory";

export type FormStatus = "idle" | "submitting" | "success" | "error";

interface ResetPasswordState {
  token: string;
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  status: FormStatus;
  error: AuthServiceError | null;
  fieldErrors: Record<string, string[]>;
}

type ResetPasswordAction =
  | { type: "SET_TOKEN"; token: string }
  | { type: "SET_PASSWORD"; password: string }
  | { type: "SET_CONFIRM_PASSWORD"; confirmPassword: string }
  | { type: "TOGGLE_PASSWORD_VISIBILITY" }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS" }
  | { type: "SUBMIT_ERROR"; error: AuthServiceError }
  | { type: "SET_FIELD_ERRORS"; fieldErrors: Record<string, string[]> }
  | { type: "RESET" };

function reducer(state: ResetPasswordState, action: ResetPasswordAction): ResetPasswordState {
  switch (action.type) {
    case "SET_TOKEN": return { ...state, token: action.token };
    case "SET_PASSWORD": return { ...state, password: action.password, error: null, fieldErrors: {} };
    case "SET_CONFIRM_PASSWORD": return { ...state, confirmPassword: action.confirmPassword, error: null, fieldErrors: {} };
    case "TOGGLE_PASSWORD_VISIBILITY": return { ...state, showPassword: !state.showPassword };
    case "SUBMIT_START": return { ...state, status: "submitting", error: null, fieldErrors: {} };
    case "SUBMIT_SUCCESS": return { ...state, status: "success" };
    case "SUBMIT_ERROR": return { ...state, status: "error", error: action.error };
    case "SET_FIELD_ERRORS": return { ...state, status: "idle", fieldErrors: action.fieldErrors };
    case "RESET": return { ...initialState };
    default: return state;
  }
}

const initialState: ResetPasswordState = {
  token: "",
  password: "",
  confirmPassword: "",
  showPassword: false,
  status: "idle",
  error: null,
  fieldErrors: {},
};

export function useResetPasswordViewModel() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const authService = getAuthService();

  const passwordStrength = useMemo(() => {
    const pw = state.password;
    if (!pw) return { score: 0, label: "" };
    let score = 0;
    if (pw.length >= 8) score += 25;
    if (pw.length >= 12) score += 15;
    if (/[A-Z]/.test(pw)) score += 20;
    if (/[a-z]/.test(pw)) score += 10;
    if (/[0-9]/.test(pw)) score += 15;
    if (/[^A-Za-z0-9]/.test(pw)) score += 15;
    const label = score >= 90 ? "Strong" : score >= 60 ? "Moderate" : score >= 30 ? "Fair" : "Weak";
    return { score, label };
  }, [state.password]);

  useEffect(() => {
    if (typeof window !== "undefined" && !state.token) {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token") ?? "";
      if (token) {
        dispatch({ type: "SET_TOKEN", token });
      }
    }
  }, [state.token]);

  const setToken = useCallback((token: string) => dispatch({ type: "SET_TOKEN", token }), []);
  const setPassword = useCallback((password: string) => dispatch({ type: "SET_PASSWORD", password }), []);
  const setConfirmPassword = useCallback((confirmPassword: string) => dispatch({ type: "SET_CONFIRM_PASSWORD", confirmPassword }), []);
  const togglePasswordVisibility = useCallback(() => dispatch({ type: "TOGGLE_PASSWORD_VISIBILITY" }), []);

  const submit = useCallback(async () => {
    const validation = validateResetPasswordInput({
      token: state.token,
      password: state.password,
      confirmPassword: state.confirmPassword,
    });
    if (!validation.valid) {
      dispatch({ type: "SET_FIELD_ERRORS", fieldErrors: validation.errors });
      return null;
    }

    dispatch({ type: "SUBMIT_START" });
    const result = await authService.resetPassword({
      token: state.token,
      password: state.password,
      confirmPassword: state.confirmPassword,
    });
    if (result.success) {
      dispatch({ type: "SUBMIT_SUCCESS" });
      return result.data;
    }
    dispatch({ type: "SUBMIT_ERROR", error: result.error });
    return null;
  }, [state.token, state.password, state.confirmPassword, authService]);

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    token: state.token,
    password: state.password,
    confirmPassword: state.confirmPassword,
    showPassword: state.showPassword,
    passwordStrength,
    status: state.status,
    error: state.error,
    fieldErrors: state.fieldErrors,
    setPassword,
    setConfirmPassword,
    togglePasswordVisibility,
    setToken,
    submit,
    reset,
  };
}

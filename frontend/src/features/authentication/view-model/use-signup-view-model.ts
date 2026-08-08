"use client";

import { useCallback, useReducer, useMemo } from "react";
import type { AuthServiceError } from "../model/auth.model";
import { validateSignupInput } from "../model/auth.schema";
import { getAuthService } from "../services/auth-service.factory";

export type FormStatus = "idle" | "submitting" | "success" | "error";

interface SignupState {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
  privacyAcknowledged: boolean;
  dataProcessingAcknowledged: boolean;
  aiFeatureAcknowledged: boolean;
  journalAnalysisConsent: boolean;
  showPassword: boolean;
  status: FormStatus;
  error: AuthServiceError | null;
  fieldErrors: Record<string, string[]>;
}

type SignupAction =
  | { type: "SET_NAME"; name: string }
  | { type: "SET_EMAIL"; email: string }
  | { type: "SET_PASSWORD"; password: string }
  | { type: "SET_CONFIRM_PASSWORD"; confirmPassword: string }
  | { type: "SET_TERMS_ACCEPTED"; termsAccepted: boolean }
  | { type: "SET_PRIVACY_ACKNOWLEDGED"; privacyAcknowledged: boolean }
  | { type: "SET_DATA_PROCESSING_ACKNOWLEDGED"; dataProcessingAcknowledged: boolean }
  | { type: "SET_AI_FEATURE_ACKNOWLEDGED"; aiFeatureAcknowledged: boolean }
  | { type: "SET_JOURNAL_ANALYSIS_CONSENT"; journalAnalysisConsent: boolean }
  | { type: "TOGGLE_PASSWORD_VISIBILITY" }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS" }
  | { type: "SUBMIT_ERROR"; error: AuthServiceError }
  | { type: "SET_FIELD_ERRORS"; fieldErrors: Record<string, string[]> }
  | { type: "RESET" };

function signupReducer(state: SignupState, action: SignupAction): SignupState {
  switch (action.type) {
    case "SET_NAME": return { ...state, name: action.name, error: null, fieldErrors: {} };
    case "SET_EMAIL": return { ...state, email: action.email, error: null, fieldErrors: {} };
    case "SET_PASSWORD": return { ...state, password: action.password, error: null, fieldErrors: {} };
    case "SET_CONFIRM_PASSWORD": return { ...state, confirmPassword: action.confirmPassword, error: null, fieldErrors: {} };
    case "SET_TERMS_ACCEPTED": return { ...state, termsAccepted: action.termsAccepted, error: null, fieldErrors: {} };
    case "SET_PRIVACY_ACKNOWLEDGED": return { ...state, privacyAcknowledged: action.privacyAcknowledged, error: null, fieldErrors: {} };
    case "SET_DATA_PROCESSING_ACKNOWLEDGED": return { ...state, dataProcessingAcknowledged: action.dataProcessingAcknowledged, error: null, fieldErrors: {} };
    case "SET_AI_FEATURE_ACKNOWLEDGED": return { ...state, aiFeatureAcknowledged: action.aiFeatureAcknowledged, error: null, fieldErrors: {} };
    case "SET_JOURNAL_ANALYSIS_CONSENT": return { ...state, journalAnalysisConsent: action.journalAnalysisConsent, error: null, fieldErrors: {} };
    case "TOGGLE_PASSWORD_VISIBILITY": return { ...state, showPassword: !state.showPassword };
    case "SUBMIT_START": return { ...state, status: "submitting", error: null, fieldErrors: {} };
    case "SUBMIT_SUCCESS": return { ...state, status: "success" };
    case "SUBMIT_ERROR": return { ...state, status: "error", error: action.error };
    case "SET_FIELD_ERRORS": return { ...state, status: "idle", fieldErrors: action.fieldErrors };
    case "RESET": return { ...initialSignupState };
    default: return state;
  }
}

const initialSignupState: SignupState = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  termsAccepted: false,
  privacyAcknowledged: false,
  dataProcessingAcknowledged: false,
  aiFeatureAcknowledged: false,
  journalAnalysisConsent: false,
  showPassword: false,
  status: "idle",
  error: null,
  fieldErrors: {},
};

export function useSignupViewModel() {
  const [state, dispatch] = useReducer(signupReducer, initialSignupState);
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

  const setName = useCallback((name: string) => dispatch({ type: "SET_NAME", name }), []);
  const setEmail = useCallback((email: string) => dispatch({ type: "SET_EMAIL", email }), []);
  const setPassword = useCallback((password: string) => dispatch({ type: "SET_PASSWORD", password }), []);
  const setConfirmPassword = useCallback((confirmPassword: string) => dispatch({ type: "SET_CONFIRM_PASSWORD", confirmPassword }), []);
  const setTermsAccepted = useCallback((termsAccepted: boolean) => dispatch({ type: "SET_TERMS_ACCEPTED", termsAccepted }), []);
  const setPrivacyAcknowledged = useCallback((privacyAcknowledged: boolean) => dispatch({ type: "SET_PRIVACY_ACKNOWLEDGED", privacyAcknowledged }), []);
  const setDataProcessingAcknowledged = useCallback((dataProcessingAcknowledged: boolean) => dispatch({ type: "SET_DATA_PROCESSING_ACKNOWLEDGED", dataProcessingAcknowledged }), []);
  const setAiFeatureAcknowledged = useCallback((aiFeatureAcknowledged: boolean) => dispatch({ type: "SET_AI_FEATURE_ACKNOWLEDGED", aiFeatureAcknowledged }), []);
  const setJournalAnalysisConsent = useCallback((journalAnalysisConsent: boolean) => dispatch({ type: "SET_JOURNAL_ANALYSIS_CONSENT", journalAnalysisConsent }), []);
  const togglePasswordVisibility = useCallback(() => dispatch({ type: "TOGGLE_PASSWORD_VISIBILITY" }), []);

  const submit = useCallback(async () => {
    const validation = validateSignupInput({
      name: state.name,
      email: state.email,
      password: state.password,
      confirmPassword: state.confirmPassword,
      termsAccepted: state.termsAccepted,
      privacyAcknowledged: state.privacyAcknowledged,
      dataProcessingAcknowledged: state.dataProcessingAcknowledged,
      aiFeatureAcknowledged: state.aiFeatureAcknowledged,
      journalAnalysisConsent: state.journalAnalysisConsent,
    });
    if (!validation.valid) {
      dispatch({ type: "SET_FIELD_ERRORS", fieldErrors: validation.errors });
      return null;
    }

    dispatch({ type: "SUBMIT_START" });
    const result = await authService.signup({
      name: state.name.trim(),
      email: state.email.trim(),
      password: state.password,
      confirmPassword: state.confirmPassword,
      termsAccepted: state.termsAccepted,
      privacyAcknowledged: state.privacyAcknowledged,
      dataProcessingAcknowledged: state.dataProcessingAcknowledged,
      aiFeatureAcknowledged: state.aiFeatureAcknowledged,
      journalAnalysisConsent: state.journalAnalysisConsent,
    });
    if (result.success) {
      dispatch({ type: "SUBMIT_SUCCESS" });
      return result.data;
    }
    dispatch({ type: "SUBMIT_ERROR", error: result.error });
    return null;
  }, [state.name, state.email, state.password, state.confirmPassword, state.termsAccepted, state.privacyAcknowledged, state.dataProcessingAcknowledged, state.aiFeatureAcknowledged, state.journalAnalysisConsent, authService]);

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    name: state.name,
    email: state.email,
    password: state.password,
    confirmPassword: state.confirmPassword,
    termsAccepted: state.termsAccepted,
    privacyAcknowledged: state.privacyAcknowledged,
    dataProcessingAcknowledged: state.dataProcessingAcknowledged,
    aiFeatureAcknowledged: state.aiFeatureAcknowledged,
    journalAnalysisConsent: state.journalAnalysisConsent,
    showPassword: state.showPassword,
    passwordStrength,
    status: state.status,
    error: state.error,
    fieldErrors: state.fieldErrors,
    setName,
    setEmail,
    setPassword,
    setConfirmPassword,
    setTermsAccepted,
    setPrivacyAcknowledged,
    setDataProcessingAcknowledged,
    setAiFeatureAcknowledged,
    setJournalAnalysisConsent,
    togglePasswordVisibility,
    submit,
    reset,
  };
}

"use client";
import { useCallback, useEffect, useMemo, useReducer } from "react";
import { getVerificationService } from "../services/verification-service.factory";
import type {
  GuardianDetails,
  VerificationAddress,
  VerificationApplication,
  VerificationDocumentKind,
  VerificationSnapshot,
} from "../model";

export const emptyAddress: VerificationAddress = {
  line1: "",
  line2: null,
  city: "",
  province: "",
  postalCode: "",
  countryCode: "PH",
};

export const emptyGuardian: GuardianDetails = {
  legalName: "",
  relationship: "",
  phoneNumber: "",
  email: null,
  address: { ...emptyAddress },
  governmentIdType: "",
  governmentIdNumber: "",
};

export const emptyApplication: VerificationApplication = {
  legalName: "",
  dateOfBirth: "",
  phoneNumber: "",
  address: { ...emptyAddress },
  governmentIdType: "",
  governmentIdNumber: "",
  guardian: null,
  privacyNoticeAccepted: true,
  identityVerificationConsent: true,
  guardianConsent: false,
};

interface VerificationState {
  snapshot: VerificationSnapshot | null;
  form: VerificationApplication;
  step: number;
  loading: boolean;
  busy: boolean;
  uploading: VerificationDocumentKind | null;
  error: string | null;
}

type VerificationAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; snapshot: VerificationSnapshot }
  | { type: "LOAD_ERROR"; error: string }
  | { type: "SET_FORM"; form: VerificationApplication }
  | { type: "SET_STEP"; step: number }
  | { type: "SET_BUSY"; busy: boolean }
  | { type: "SET_UPLOADING"; kind: VerificationDocumentKind | null }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_SNAPSHOT"; snapshot: VerificationSnapshot };

const initialState: VerificationState = {
  snapshot: null,
  form: emptyApplication,
  step: 0,
  loading: true,
  busy: false,
  uploading: null,
  error: null,
};

function reducer(state: VerificationState, action: VerificationAction): VerificationState {
  switch (action.type) {
    case "LOAD_START": return { ...state, loading: true };
    case "LOAD_SUCCESS": return { ...state, snapshot: action.snapshot, form: action.snapshot.application ?? state.form, loading: false };
    case "LOAD_ERROR": return { ...state, error: action.error, loading: false };
    case "SET_FORM": return { ...state, form: action.form };
    case "SET_STEP": return { ...state, step: action.step, error: null };
    case "SET_BUSY": return { ...state, busy: action.busy };
    case "SET_UPLOADING": return { ...state, uploading: action.kind };
    case "SET_ERROR": return { ...state, error: action.error };
    case "SET_SNAPSHOT": return { ...state, snapshot: action.snapshot };
    default: return state;
  }
}

export function ageFromDate(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const birth = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function masked(value: string): string {
  const cleaned = value.trim();
  if (cleaned.length <= 4) return "••••";
  return `${"•".repeat(Math.min(8, cleaned.length - 4))}${cleaned.slice(-4)}`;
}

export function formatBytes(value: number): string {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function useVerificationViewModel() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const service = getVerificationService();

  const age = useMemo(() => ageFromDate(state.form.dateOfBirth), [state.form.dateOfBirth]);
  const isMinor = age !== null && age < (state.snapshot?.adultAge ?? 18);

  useEffect(() => {
    let active = true;
    void service.getStatus().then((result) => {
      if (!active) return;
      if (result.success) dispatch({ type: "LOAD_SUCCESS", snapshot: result.data });
      else dispatch({ type: "LOAD_ERROR", error: result.error.message });
    });
    return () => {
      active = false;
    };
  }, [service]);

  const setForm = useCallback((form: VerificationApplication) => {
    dispatch({ type: "SET_FORM", form });
  }, []);

  const setStep = useCallback((step: number) => {
    dispatch({ type: "SET_STEP", step });
  }, []);

  const updateGuardian = useCallback((next: GuardianDetails) => {
    dispatch({ type: "SET_FORM", form: { ...state.form, guardian: next } });
  }, [state.form]);

  const goNext = useCallback(
    (event: { preventDefault: () => void }) => {
      event.preventDefault();
      dispatch({ type: "SET_ERROR", error: null });
      if (state.step === 0) {
        if (age === null) {
          dispatch({ type: "SET_ERROR", error: "Enter a valid date of birth." });
          return;
        }
        if (age < (state.snapshot?.minimumAge ?? 13)) {
          dispatch({
            type: "SET_ERROR",
            error: `ECHO accounts are currently available from age ${state.snapshot?.minimumAge ?? 13}. Public support resources remain available.`,
          });
          return;
        }
        dispatch({
          type: "SET_FORM",
          form: {
            ...state.form,
            guardian: age < (state.snapshot?.adultAge ?? 18) ? state.form.guardian ?? { ...emptyGuardian, address: { ...emptyAddress } } : null,
            guardianConsent: age < (state.snapshot?.adultAge ?? 18) ? state.form.guardianConsent : false,
          },
        });
        dispatch({ type: "SET_STEP", step: 1 });
        return;
      }
      if (state.step === 1) {
        if (!state.form.privacyNoticeAccepted || !state.form.identityVerificationConsent) {
          dispatch({ type: "SET_ERROR", error: "Accept the verification notice and identity-check consent to continue." });
          return;
        }
        if (isMinor && (!state.form.guardian || !state.form.guardianConsent)) {
          dispatch({ type: "SET_ERROR", error: "A parent or legal guardian and their consent are required for users under 18." });
          return;
        }
        dispatch({ type: "SET_BUSY", busy: true });
        void service
          .saveApplication({
            ...state.form,
            guardian: isMinor ? state.form.guardian : null,
            guardianConsent: isMinor ? state.form.guardianConsent : false,
          })
          .then((result) => {
            if (result.success) {
              dispatch({ type: "SET_SNAPSHOT", snapshot: result.data });
              if (result.data.application) dispatch({ type: "SET_FORM", form: result.data.application });
              dispatch({ type: "SET_STEP", step: 2 });
            } else {
              dispatch({ type: "SET_ERROR", error: result.error.message });
            }
          })
          .finally(() => dispatch({ type: "SET_BUSY", busy: false }));
        return;
      }
      dispatch({ type: "SET_STEP", step: Math.min(3, state.step + 1) });
    },
    [service, state.step, state.form, age, isMinor, state.snapshot],
  );

  const upload = useCallback(
    async (kind: VerificationDocumentKind, file: File | undefined) => {
      if (!file) return;
      if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
        dispatch({ type: "SET_ERROR", error: "Upload a JPG, PNG, or PDF document." });
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        dispatch({ type: "SET_ERROR", error: "Upload a document no larger than 8 MB." });
        return;
      }
      dispatch({ type: "SET_ERROR", error: null });
      dispatch({ type: "SET_UPLOADING", kind });
      try {
        const result = await service.uploadDocument(kind, file);
        if (result.success) dispatch({ type: "SET_SNAPSHOT", snapshot: result.data });
        else dispatch({ type: "SET_ERROR", error: result.error.message });
      } finally {
        dispatch({ type: "SET_UPLOADING", kind: null });
      }
    },
    [service],
  );

  const submit = useCallback(async () => {
    dispatch({ type: "SET_BUSY", busy: true });
    dispatch({ type: "SET_ERROR", error: null });
    try {
      const result = await service.submit();
      if (result.success) dispatch({ type: "SET_SNAPSHOT", snapshot: result.data });
      else dispatch({ type: "SET_ERROR", error: result.error.message });
    } finally {
      dispatch({ type: "SET_BUSY", busy: false });
    }
  }, [service]);

  return {
    ...state,
    age,
    isMinor,
    setForm,
    setStep,
    updateGuardian,
    goNext,
    upload,
    submit,
  };
}
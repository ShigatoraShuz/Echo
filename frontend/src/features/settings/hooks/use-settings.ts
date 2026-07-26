"use client";
import { useCallback, useEffect, useReducer } from "react";
import type { ProfileSettings, PrivacySettings, NotificationSettings, TrustedContact } from "../model/settings.model";

interface SettingsState {
  profile: ProfileSettings | null;
  privacy: PrivacySettings | null;
  notifications: NotificationSettings | null;
  contacts: TrustedContact[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  notice: string | null;
}

type SettingsAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; profile: ProfileSettings; privacy: PrivacySettings; notifications: NotificationSettings; contacts: TrustedContact[] }
  | { type: "LOAD_ERROR"; error: string }
  | { type: "SAVE_START" }
  | { type: "SAVE_SUCCESS"; notice: string }
  | { type: "SAVE_ERROR"; error: string }
  | { type: "UPDATE_PROFILE"; profile: ProfileSettings }
  | { type: "UPDATE_PRIVACY"; privacy: PrivacySettings }
  | { type: "UPDATE_NOTIFICATIONS"; notifications: NotificationSettings }
  | { type: "UPDATE_CONTACTS"; contacts: TrustedContact[] }
  | { type: "CLEAR_NOTICE" }
  | { type: "CLEAR_ERROR" };

const initialState: SettingsState = {
  profile: null, privacy: null, notifications: null, contacts: [],
  isLoading: true, isSaving: false, error: null, notice: null,
};

function reducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case "LOAD_START": return { ...state, isLoading: true, error: null };
    case "LOAD_SUCCESS": return { ...state, profile: action.profile, privacy: action.privacy, notifications: action.notifications, contacts: action.contacts, isLoading: false };
    case "LOAD_ERROR": return { ...state, error: action.error, isLoading: false };
    case "SAVE_START": return { ...state, isSaving: true, error: null, notice: null };
    case "SAVE_SUCCESS": return { ...state, isSaving: false, notice: action.notice };
    case "SAVE_ERROR": return { ...state, isSaving: false, error: action.error };
    case "UPDATE_PROFILE": return { ...state, profile: action.profile };
    case "UPDATE_PRIVACY": return { ...state, privacy: action.privacy };
    case "UPDATE_NOTIFICATIONS": return { ...state, notifications: action.notifications };
    case "UPDATE_CONTACTS": return { ...state, contacts: action.contacts };
    case "CLEAR_NOTICE": return { ...state, notice: null };
    case "CLEAR_ERROR": return { ...state, error: null };
    default: return state;
  }
}

export function useSettingsViewModel() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const load = useCallback(async () => {
    dispatch({ type: "LOAD_START" });
    try {
      const [profile, privacy, notifications, contacts] = await Promise.all([
        fetch("/api/settings/profile").then(r => r.json()),
        fetch("/api/settings/privacy").then(r => r.json()),
        fetch("/api/settings/notifications").then(r => r.json()),
        fetch("/api/settings/contacts").then(r => r.json()),
      ]);
      dispatch({ type: "LOAD_SUCCESS", profile, privacy, notifications, contacts });
    } catch (err) {
      dispatch({ type: "LOAD_ERROR", error: "Failed to load settings" });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return {
    ...state,
    load,
    dispatch,
    updateProfile: async (updates: Partial<ProfileSettings>) => {
      dispatch({ type: "SAVE_START" });
      try { await fetch("/api/settings/profile", { method: "PATCH", body: JSON.stringify(updates) }); dispatch({ type: "SAVE_SUCCESS", notice: "Profile updated" }); } catch { dispatch({ type: "SAVE_ERROR", error: "Failed to save" }); }
    },
    updatePrivacy: async (updates: Partial<PrivacySettings>) => {
      dispatch({ type: "SAVE_START" });
      try { await fetch("/api/settings/privacy", { method: "PATCH", body: JSON.stringify(updates) }); dispatch({ type: "SAVE_SUCCESS", notice: "Privacy settings updated" }); } catch { dispatch({ type: "SAVE_ERROR", error: "Failed to save" }); }
    },
    updateNotifications: async (updates: Partial<NotificationSettings>) => {
      dispatch({ type: "SAVE_START" });
      try { await fetch("/api/settings/notifications", { method: "PATCH", body: JSON.stringify(updates) }); dispatch({ type: "SAVE_SUCCESS", notice: "Notification settings updated" }); } catch { dispatch({ type: "SAVE_ERROR", error: "Failed to save" }); }
    },
  };
}

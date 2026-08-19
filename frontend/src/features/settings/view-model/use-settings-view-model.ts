"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeError } from "@/shared/errors/normalize-error";
import type { SettingsSnapshot } from "../model/settings.model";
import { settingsService } from "@/services/settings/settings.service";

export interface UseSettingsViewModelResult {
  settings: SettingsSnapshot | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  notice: string | null;
  refresh: () => Promise<void>;
  run: <T>(operation: () => Promise<T>, successMessage: string) => Promise<boolean>;
}

export function useSettingsViewModel(): UseSettingsViewModelResult {
  const [settings, setSettings] = useState<SettingsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async (background: boolean) => {
    if (!background) setLoading(true);
    try {
      const snapshot = await settingsService.get();
      if (!mountedRef.current) return;
      setSettings(snapshot);
      setError(null);
    } catch (loadError) {
      if (!mountedRef.current) return;
      setError(normalizeError(loadError).userMessage);
    } finally {
      if (mountedRef.current && !background) setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => load(false), [load]);

  const run = useCallback(
    async <T,>(operation: () => Promise<T>, successMessage: string): Promise<boolean> => {
      setSaving(true);
      setError(null);
      setNotice(null);
      try {
        await operation();
        setNotice(successMessage);
        await load(true);
        return true;
      } catch (runError) {
        if (mountedRef.current) setError(normalizeError(runError).userMessage);
        return false;
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [load],
  );

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  return { settings, loading, saving, error, notice, refresh, run };
}
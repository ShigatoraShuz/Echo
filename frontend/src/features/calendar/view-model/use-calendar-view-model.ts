"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { DefaultJournalFilters, type JournalAnalysis, type JournalEntry } from "@/features/journal/model/journal.model";
import { getJournalService } from "@/services/journal/journal-service.factory";
import { calendarApi, type CalendarItem } from "@/services/calendar/calendar-api";
import { professionalApi, type ProfessionalAppointment } from "@/services/professionals/professional-api";
import { normalizeError } from "@/shared/errors/normalize-error";
import { getCalendarDays, toLocalDateKey } from "../model/calendar-date";

export function useCalendarViewModel() {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(() => toLocalDateKey(new Date()));
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [appointments, setAppointments] = useState<ProfessionalAppointment[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, JournalAnalysis | null | false>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [content, setContent] = useState("");
  const [time, setTime] = useState("");
  const [kind, setKind] = useState<"reminder" | "note">("reminder");
  const days = useMemo(() => getCalendarDays(month), [month]);
  const from = toLocalDateKey(new Date(days[0].getFullYear(), days[0].getMonth(), days[0].getDate() - 1));
  const last = days[days.length - 1];
  const to = toLocalDateKey(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  const entryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      const day = toLocalDateKey(new Date(entry.createdAt));
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return counts;
  }, [entries]);
  const itemCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.scheduledOn, (counts.get(item.scheduledOn) ?? 0) + 1);
    return counts;
  }, [items]);
  const visibleAppointments = useMemo(() => appointments.filter((item) =>
    ["proposed", "confirmed", "completed"].includes(item.status)), [appointments]);
  const appointmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const appointment of visibleAppointments) {
      const day = toLocalDateKey(new Date(appointment.startsAt));
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return counts;
  }, [visibleAppointments]);
  const selectedEntries = useMemo(() => entries.filter((entry) => toLocalDateKey(new Date(entry.createdAt)) === selected), [entries, selected]);
  const selectedItems = useMemo(() => items.filter((item) => item.scheduledOn === selected), [items, selected]);
  const selectedAppointments = useMemo(() => visibleAppointments.filter((item) =>
    toLocalDateKey(new Date(item.startsAt)) === selected), [visibleAppointments, selected]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    async function load() {
      try {
        const journal = getJournalService();
        let itemError: string | null = null;
        let appointmentError: string | null = null;
        const [savedItems, scheduled, first] = await Promise.all([
          calendarApi.list(from, to, controller.signal).catch((cause: unknown) => {
            itemError = normalizeError(cause).userMessage;
            return null;
          }),
          professionalApi.appointments({
            from: days[0].toISOString(),
            to: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1).toISOString(),
          }, controller.signal).catch((cause: unknown) => {
            appointmentError = normalizeError(cause).userMessage;
            return null;
          }),
          journal.listEntries({ ...DefaultJournalFilters, dateFrom: from, dateTo: to }, 1, 50, controller.signal),
        ]);
        if (!first.success) throw new Error(first.error.message);
        const allEntries = [...first.data.entries];
        for (let page = 2; page <= first.data.pagination.totalPages; page++) {
          const next = await journal.listEntries(
            { ...DefaultJournalFilters, dateFrom: from, dateTo: to }, page, 50, controller.signal,
          );
          if (!next.success) throw new Error(next.error.message);
          allEntries.push(...next.data.entries);
        }
        if (!controller.signal.aborted) {
          setItems(savedItems ?? []);
          setAppointments(scheduled?.appointments ?? []);
          setEntries(allEntries);
          setError([itemError, appointmentError].filter(Boolean).join(" ") || null);
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(normalizeError(cause).userMessage);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [from, to, days, last, reloadCount]);

  useEffect(() => {
    const controller = new AbortController();
    const journal = getJournalService();
    void Promise.all(
      selectedEntries.filter((entry) => entry.analysisConsent).map(async (entry) => {
        const result = await journal.getAnalysis(entry.id);
        return [entry.id, result.success ? (result.data && !result.data.isDemoData ? result.data : null) : false] as const;
      }),
    ).then((results) => {
      if (!controller.signal.aborted) setAnalyses(Object.fromEntries(results));
    });
    return () => controller.abort();
  }, [selectedEntries]);

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const item = await calendarApi.create({ scheduledOn: selected, scheduledTime: time || null, kind, content: content.trim() });
      setItems((current) => [...current, item]);
      setContent("");
      setTime("");
    } catch (cause) {
      setError(normalizeError(cause).userMessage);
    } finally {
      setSaving(false);
    }
  }

  async function toggleItem(item: CalendarItem) {
    try {
      const updated = await calendarApi.update(item, !item.completedAt);
      setItems((current) => current.map((candidate) => candidate.id === item.id ? updated : candidate));
    } catch (cause) {
      setError(normalizeError(cause).userMessage);
    }
  }

  async function removeItem(item: CalendarItem) {
    if (!window.confirm(`Delete this ${item.kind}?`)) return;
    try {
      await calendarApi.remove(item.id);
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    } catch (cause) {
      setError(normalizeError(cause).userMessage);
    }
  }

  function goToday() {
    const today = new Date();
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(toLocalDateKey(today));
  }

  function shiftMonth(amount: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1));
  }

  return {
    month, days, selected, selectedEntries, selectedItems, selectedAppointments,
    entryCounts, itemCounts, appointmentCounts, analyses,
    loading, saving, error, content, time, kind, setSelected, setContent, setTime, setKind,
    goToday, shiftMonth, addItem, toggleItem, removeItem, retry: () => setReloadCount((count) => count + 1),
  };
}

"use client";

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { useWorkspaceRefresh } from "@/shared/hooks/use-workspace-refresh";

type Entry = { pending?: Promise<unknown>; value?: unknown; expires: number };
type Topic = "notifications" | "appointments";
/** Mounted beneath the verified actor/organization/role boundary. Nothing persists. */
export function createProfessionalReads() {
  const entries = new Map<string, Entry>();
  const listeners = new Map<() => void, Topic>();
  let paused = false;
  return {
    clear: () => entries.clear(),
    pause: () => { paused = true; entries.clear(); },
    resume: () => { paused = false; },
    subscribe(callback: () => void, topic: Topic) { listeners.set(callback, topic); return () => { listeners.delete(callback); }; },
    refresh(topics: Set<Topic>) { if (!paused) listeners.forEach((topic, callback) => { if (topics.has(topic)) callback(); }); },
    read<T>(key: string, load: () => Promise<T>, age = 0): Promise<T> {
      const existing = entries.get(key);
      if (existing?.pending) return existing.pending as Promise<T>;
      if (existing && existing.expires > Date.now()) return Promise.resolve(existing.value as T);
      const entry: Entry = { expires: 0 };
      const pending = Promise.resolve().then(load);
      entry.pending = pending; entries.set(key, entry);
      void pending.then(value => {
        if (entries.get(key) !== entry) return;
        if (!age) entries.delete(key);
        else { entry.pending = undefined; entry.value = value; entry.expires = Date.now() + age; }
      }, () => { if (entries.get(key) === entry) entries.delete(key); });
      return pending;
    },
  };
}
type Reads = ReturnType<typeof createProfessionalReads>;
const Context = createContext<Reads | null>(null);
export function ProfessionalReadScope({ children }: { children: ReactNode }) {
  const reads = useRef<Reads | null>(null);
  reads.current ??= createProfessionalReads();
  useEffect(() => {
    const current = reads.current!;
    current.resume();
    let stopped = false, queued = false, last = 0;
    const topics = new Set<Topic>();
    const schedule = (event?: Event) => {
      const mutation = event?.type.startsWith("echo:");
      if (stopped) return;
      if (mutation) current.clear();
      if (document.visibilityState === "hidden" || !mutation && Date.now() - last < 1000) return;
      // Focus/visibility must check for arrivals even if navigation just reused
      // the one-second metadata snapshot. Hidden pages only invalidate.
      current.clear();
      if (event?.type !== "echo:notifications-changed") topics.add("appointments");
      topics.add("notifications");
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        if (stopped) return;
        last = Date.now(); current.refresh(topics); topics.clear();
      });
    };
    const stop = () => { stopped = true; current.pause(); window.clearInterval(timer); };
    const events = ["focus", "echo:notifications-changed", "echo:appointments-changed"];
    const timer = window.setInterval(schedule, 60_000);
    events.forEach(event => window.addEventListener(event, schedule));
    document.addEventListener("visibilitychange", schedule);
    window.addEventListener("echo:sensitive-state-cleared", stop, true);
    window.addEventListener("echo:professional-access-lost", stop, true);
    return () => {
      stop(); events.forEach(event => window.removeEventListener(event, schedule));
      document.removeEventListener("visibilitychange", schedule);
      window.removeEventListener("echo:sensitive-state-cleared", stop, true);
      window.removeEventListener("echo:professional-access-lost", stop, true);
    };
  }, []);
  return <Context.Provider value={reads.current}>{children}</Context.Provider>;
}
export function useProfessionalRead() {
  const reads = useContext(Context);
  // Standalone screens/tests still authorize through their usual API endpoint.
  return useCallback(<T,>(key: string, load: () => Promise<T>, age = 0) => reads ? reads.read(key, load, age) : load(), [reads]);
}
export function usePauseProfessionalReads() {
  const reads = useContext(Context);
  return useCallback(() => reads?.pause(), [reads]);
}

/** One visible-only scheduler for the mounted workspace, with topic invalidation. */
export function useProfessionalRefresh(refresh: () => void, scope: string, clear: () => void, topic: Topic) {
  const reads = useContext(Context);
  const latest = useRef(refresh);
  useEffect(() => { latest.current = refresh; });
  useWorkspaceRefresh(refresh, reads ? "" : scope, clear);
  useEffect(() => {
    if (!reads || !scope) return;
    return reads.subscribe(() => latest.current(), topic);
  }, [reads, scope, topic]);
}

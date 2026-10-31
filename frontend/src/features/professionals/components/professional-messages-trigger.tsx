"use client";

import { MessageCircle, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";

type Drawer = typeof import("./professional-message-drawer").default;
// Cache executable code only. No session, organization, transcript or draft lives here.
let drawerCode: Drawer | null = null;
let pendingCode: Promise<Drawer> | null = null;
function loadDrawer() {
  return pendingCode ??= import("./professional-message-drawer").then(module => {
    drawerCode = module.default;
    return module.default;
  }).catch(reason => { pendingCode = null; throw reason; });
}

/** No inbox request or transcript is fetched until the user opens Messages. */
export function ProfessionalMessagesTrigger({ organizationId, userId, role }: { organizationId: string; userId: string; role: string }) {
  const [open, setOpen] = useState(false);
  const [DrawerComponent, setDrawer] = useState<Drawer | null>(() => drawerCode);
  const [loadError, setLoadError] = useState(false);
  const alive = useRef(true);
  const trigger = useRef<HTMLButtonElement>(null);
  const keyboard = useRef(false);
  const enteredAt = useRef(0);
  const close = useCallback(() => { setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); }, []);
  function prepare() {
    setLoadError(false);
    void loadDrawer().then(component => { if (alive.current) setDrawer(() => component); }).catch(() => { if (alive.current) setLoadError(true); });
  }
  useEffect(() => {
    alive.current = true;
    const clear = () => setOpen(false);
    const hide = () => { if (document.visibilityState === "hidden") clear(); };
    window.addEventListener("echo:sensitive-state-cleared", clear);
    window.addEventListener("echo:professional-access-lost", clear);
    document.addEventListener("visibilitychange", hide);
    return () => { alive.current = false; window.removeEventListener("echo:sensitive-state-cleared", clear); window.removeEventListener("echo:professional-access-lost", clear); document.removeEventListener("visibilitychange", hide); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); close(); } };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open, close]);
  return <>
    <button ref={trigger} type="button" aria-label="Messages" aria-haspopup="dialog" aria-expanded={open} disabled={!organizationId || !userId} onClick={event => { keyboard.current = event.detail === 0; enteredAt.current = performance.now(); setOpen(value => !value); if (!open && !DrawerComponent) prepare(); }} className="echo-focus-ring pro-command-icon"><MessageCircle size={20} aria-hidden="true" /></button>
    {open ? DrawerComponent ? <DrawerComponent organizationId={organizationId} userId={userId} role={role} onClose={close} instant={keyboard.current} enteredAt={enteredAt.current} /> : <MessageCodeLoading onClose={close} instant={keyboard.current} error={loadError} retry={prepare} /> : null}
  </>;
}

/** Immediate accessible chrome while the code loads, without Suspense's fallback throttle. */
function MessageCodeLoading({ onClose, instant, error, retry }: { onClose: () => void; instant: boolean; error: boolean; retry: () => void }) {
  const dialog = useFocusTrap<HTMLElement>(true);
  useEffect(() => {
    const previous = document.body.style.overflow;
    const workspace = document.querySelector<HTMLElement>(".professional-portal");
    const wasInert = workspace?.inert;
    if (workspace) workspace.inert = true;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => { document.body.style.overflow = previous; if (workspace) workspace.inert = wasInert ?? false; };
  }, [dialog]);
  return createPortal(<div className="pro-message-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialog} role="dialog" aria-modal="true" aria-label="Messages" className="pro-message-drawer" data-instant={instant || undefined} data-lenis-prevent><header className="pro-message-heading"><div><p className="pro-eyebrow">ECHO · Professional care</p><h2>Messages</h2></div><button type="button" aria-label="Close messages" onClick={onClose} className="echo-focus-ring pro-command-icon"><X size={20} aria-hidden="true" /></button></header>{error ? <div role="alert" className="pro-message-empty"><h3>Messages couldn’t open</h3><p>Check your connection, then try again.</p><button type="button" onClick={retry} className="echo-focus-ring pro-text-action"><RefreshCw size={16} />Retry opening messages</button></div> : <div role="status" aria-label="Opening messages" aria-busy="true" className="space-y-3 p-5"><span className="sr-only">Opening messages</span>{[0,1,2].map(value => <div key={value} className="h-24 rounded-2xl bg-secondary/50 motion-safe:animate-pulse" />)}</div>}</section></div>, document.body);
}

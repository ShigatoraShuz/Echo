"use client";
import Link from "next/link";
import { ChevronDown, Settings, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import { professionalRoleLabel } from "../professional-organizations";

export function ProfessionalAccountMenu({ name, role, settingsHref, children }: { name: string; role: string; settingsHref: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useFocusTrap<HTMLDivElement>(open);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const dismiss = (event: PointerEvent) => { if (!dialog.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    window.addEventListener("pointerdown", dismiss); window.addEventListener("keydown", escape);
    return () => { window.removeEventListener("pointerdown", dismiss); window.removeEventListener("keydown", escape); };
  }, [open, dialog]);
  return <div className="pro-account"><button ref={trigger} type="button" aria-label="Open account menu" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(value => !value)} className="echo-focus-ring pro-account-trigger"><span className="pro-account-avatar"><UserRound size={18} aria-hidden="true" /></span><span className="pro-account-name">{name || "My account"}</span><ChevronDown size={13} aria-hidden="true" /></button>{open ? <div ref={dialog} role="dialog" aria-label="Professional account" className="pro-account-panel"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-sm font-semibold">{name || "Professional account"}</p><p className="mt-1 text-xs text-muted-foreground">{professionalRoleLabel(role)}</p></div><button type="button" aria-label="Close account menu" onClick={close} className="echo-focus-ring pro-command-icon"><X size={17} /></button></div><Link href={settingsHref} onNavigate={() => setOpen(false)} className="echo-focus-ring pro-account-link"><Settings size={17} aria-hidden="true" />Profile & settings</Link><div className="pro-account-actions">{children}</div></div> : null}</div>;
}

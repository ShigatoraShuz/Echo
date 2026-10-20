"use client";
import { useState } from "react";
import { ProfessionalCrisisSupport, type CrisisPreview } from "../components/professional-crisis-support";

export function ProfessionalCrisisPreview() {
  const [open, setOpen] = useState(false); const [state, setState] = useState<CrisisPreview["state"]>("ready");
  return <details className="mt-6 rounded-3xl border border-border bg-card p-5" onToggle={(event) => setOpen(event.currentTarget.open)}><summary className="echo-focus-ring flex min-h-11 cursor-pointer items-center rounded-lg text-sm font-semibold text-primary">Inspect synthetic crisis support</summary>{open ? <div className="mt-5 space-y-5"><label className="block text-xs font-semibold">Synthetic crisis state<select className="echo-input mt-2" value={state} onChange={(event) => setState(event.target.value as CrisisPreview["state"])}>{["ready", "loading", "empty", "denied", "network", "server"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><ProfessionalCrisisSupport preview={{ state }} /></div> : null}</details>;
}

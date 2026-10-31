"use client";
import { ArrowLeft, MessageCircle, Search, Send, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import { ProfessionalMessageFrame, ProfessionalConversationRow, ProfessionalMessageBubble } from "../components/professional-message-presentation";
import type { clinicianDemo } from "./clinician-preview-fixtures";

/** Local data only. Deliberately has no reference to an API, auth context, or mutation callback. */
export function ClinicianPreviewMessages({ demo, onClose, instant }: { demo: ReturnType<typeof clinicianDemo>; onClose: () => void; instant: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const dialog = useFocusTrap<HTMLElement>(true);
  const entryDelay = useRef(0).current;
  useEffect(() => {
    const workspace = document.querySelector<HTMLElement>(".professional-portal");
    const wasInert = workspace?.inert;
    const previous = document.body.style.overflow;
    if (workspace) workspace.inert = true;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
    window.addEventListener("keydown", escape);
    return () => { window.removeEventListener("keydown", escape); if (workspace) workspace.inert = wasInert ?? false; document.body.style.overflow = previous; };
  }, [dialog, onClose]);
  const rows = demo.queue.filter(row => row.assignedTo === demo.actorId && row.id.toLowerCase().includes(search.trim().toLowerCase()) && (filter === "All" || filter === "Active" && ["assigned", "scheduled"].includes(row.status) || filter === "Closed" && row.status === "closed"));
  return <ProfessionalMessageFrame containerRef={dialog} onClose={onClose} instant={instant} entryDelay={entryDelay} eyebrow="Demo Preview — Fictional Data">
    {selected ? <><div className="pro-thread-heading"><button type="button" aria-label="Back to conversations" className="echo-focus-ring pro-command-icon" onClick={() => { setSelected(null); requestAnimationFrame(() => dialog.current?.querySelector<HTMLInputElement>("input")?.focus()); }}><ArrowLeft size={19} /></button><div><h3>Case {selected}</h3><p>Fictional conversation · Read-only demo</p></div></div><div className="pro-message-scroll pro-thread-scroll"><p className="pro-thread-privacy"><ShieldCheck size={13} />Fictional messages. No patient or clinician is connected.</p><ol className="pro-message-bubbles">{demo.messages[selected].map(message => <ProfessionalMessageBubble key={message.id} message={message} />)}</ol></div><div className="pro-message-composer"><label htmlFor="demo-message" className="sr-only">Demo message composer</label><form onSubmit={event => event.preventDefault()}><textarea id="demo-message" rows={2} disabled placeholder="Sending is disabled in this fictional preview" /><div className="pro-composer-actions"><span>No messages are sent or stored</span><button type="submit" disabled className="pro-message-send"><Send size={16} />Send</button></div></form></div></> : <><div className="pro-message-tools"><p className="text-sm font-semibold">Your case conversations</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Explore fictional conversations for this demo persona.</p><label className="pro-message-search"><Search size={17} /><input aria-label="Search case conversations" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by case ID" /></label><div className="pro-message-tabs" role="group" aria-label="Conversation status">{["All", "Active", "Closed"].map(tab => <button type="button" key={tab} className="echo-focus-ring" aria-pressed={filter === tab} onClick={() => setFilter(tab)}>{tab}</button>)}</div></div><div className="pro-message-scroll">{rows.length ? <ul className="pro-conversation-list">{rows.map(row => <ProfessionalConversationRow key={row.id} row={row} onSelect={setSelected} />)}</ul> : <div className="pro-message-empty"><MessageCircle size={32} /><h3>No matching demo cases</h3><p>Try another case ID or status.</p></div>}</div><footer className="pro-message-footer"><ShieldCheck size={14} /><p>Demo Preview — Fictional Data. No clinical API, read acknowledgement or message delivery is connected.</p></footer></>}
  </ProfessionalMessageFrame>;
}

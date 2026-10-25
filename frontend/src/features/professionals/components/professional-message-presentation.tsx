"use client";

import { ArrowUpRight, Check, MessageCircle, X } from "lucide-react";
import { useId, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { CaseMessage, QueueRequest } from "@/services/professionals/professional-api";
import { requestDate } from "../professional-request.model";
import { ProfessionalRequestStatus } from "./professional-ui";

/** Presentation only. No transport, authenticated context or authorization decisions. */
export function ProfessionalMessageFrame({ containerRef, onClose, instant, entryDelay = 0, eyebrow = "ECHO · Professional care", children }: {
  containerRef: RefObject<HTMLElement | null>; onClose: () => void; instant: boolean; entryDelay?: number; eyebrow?: string; children: ReactNode;
}) {
  const titleId = useId();
  return createPortal(<div className="pro-message-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={containerRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="pro-message-drawer" style={{ animationDelay: "-" + entryDelay + "ms" }} data-instant={instant || undefined} data-lenis-prevent>
      <header className="pro-message-heading"><div><p className="pro-eyebrow">{eyebrow}</p><h2 id={titleId}>Messages<span className="pro-message-heading-dot" aria-hidden="true" /></h2></div><button type="button" aria-label="Close messages" onClick={onClose} className="echo-focus-ring pro-command-icon"><X size={20} aria-hidden="true" /></button></header>
      {children}
    </section>
  </div>, document.body);
}

export function ProfessionalConversationRow({ row, onSelect }: { row: QueueRequest; onSelect: (id: string) => void }) {
  return <li><button type="button" className="echo-focus-ring pro-conversation" onClick={() => onSelect(row.id)}><span className="pro-conversation-avatar"><MessageCircle size={21} aria-hidden="true" /></span><span className="min-w-0"><strong>Case {row.id.slice(0, 8).toUpperCase()}</strong><span className="mt-1 block"><ProfessionalRequestStatus status={row.status} /></span><span className="pro-conversation-time">Case updated {requestDate(row.updatedAt)}</span></span><ArrowUpRight size={17} aria-hidden="true" /></button></li>;
}

export function ProfessionalMessageBubble({ message }: { message: CaseMessage }) {
  const mine = message.sender === "professional";
  return <li className="pro-message-bubble" data-mine={mine}><span className="sr-only">{mine ? "You" : "ECHO user"}: </span><p>{message.body}</p><span className="pro-message-time"><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>{mine ? <Check size={12} aria-label="Saved" /> : null}</span></li>;
}

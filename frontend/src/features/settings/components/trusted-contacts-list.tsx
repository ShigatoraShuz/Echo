"use client";
import { Phone, Mail, CheckCircle, XCircle } from "lucide-react";
import type { TrustedContact } from "../model/settings.model";

interface TrustedContactsListProps {
  contacts: TrustedContact[];
  onSelect: (contact: TrustedContact) => void;
}

export function TrustedContactsList({ contacts, onSelect }: TrustedContactsListProps) {
  if (contacts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
        <p className="text-sm text-muted-foreground">No trusted contacts yet. Add someone you trust to reach out to in difficult moments.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {contacts.map((contact) => (
        <button key={contact.id} type="button" onClick={() => onSelect(contact)} className="w-full rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-secondary/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                {contact.contactName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{contact.contactName}</p>
                <p className="text-xs text-muted-foreground">{contact.relationship}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {contact.verified ? <CheckCircle className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
              {contact.contactEmail && <Mail className="h-4 w-4 text-muted-foreground" />}
              {contact.contactPhone && <Phone className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

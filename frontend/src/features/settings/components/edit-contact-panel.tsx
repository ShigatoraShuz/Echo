"use client";
import { useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import type { TrustedContact } from "../model/settings.model";

interface EditContactPanelProps {
  contact: TrustedContact;
  onUpdate: (id: string, updates: Partial<TrustedContact>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  isSaving: boolean;
  onClose: () => void;
}

export function EditContactPanel({ contact, onUpdate, onRemove, isSaving, onClose }: EditContactPanelProps) {
  const [name, setName] = useState(contact.contactName);
  const [email, setEmail] = useState(contact.contactEmail);
  const [phone, setPhone] = useState(contact.contactPhone);
  const [relationship, setRelationship] = useState(contact.relationship);

  async function handleSave() {
    await onUpdate(contact.id, { contactName: name, contactEmail: email, contactPhone: phone, relationship });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Edit contact</h2>
          <button type="button" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Name" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Email" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Phone" />
          <input value={relationship} onChange={(e) => setRelationship(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Relationship" />
        </div>
        <div className="mt-6 flex justify-between">
          <button type="button" onClick={() => onRemove(contact.id)} disabled={isSaving} className="inline-flex items-center gap-1.5 text-sm text-danger hover:text-danger/80">
            <Trash2 className="h-4 w-4" /> Remove
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary/60">Cancel</button>
            <button type="button" onClick={handleSave} disabled={isSaving} className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";

interface AddContactFormProps {
  onAdd: (contact: { contactName: string; contactEmail: string; contactPhone: string; relationship: string }) => Promise<void>;
  isAdding: boolean;
}

export function AddContactForm({ onAdd, isAdding }: AddContactFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Name is required"); return; }
    if (!email.trim() && !phone.trim()) { setError("Email or phone is required"); return; }
    await onAdd({ contactName: name, contactEmail: email, contactPhone: phone, relationship });
    setName(""); setEmail(""); setPhone(""); setRelationship("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" type="email" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" type="tel" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      <input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="Relationship (e.g., Partner, Friend)" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={isAdding} className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{isAdding ? "Adding..." : "Add contact"}</button>
    </form>
  );
}

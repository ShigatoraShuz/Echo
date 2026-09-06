"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { settingsService } from "@/services/settings/settings.service";
export function TrustedSupport() {
  const [contacts, setContacts] = useState<
    Array<{ id: string; contactName: string; contactPhone: string | null; contactEmail: string | null }>
  >([]);
  useEffect(() => {
    let active = true;
    void settingsService
      .get()
      .then((settings) => {
        if (active) setContacts(settings.trustedContacts);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold">Reach someone you trust</h3>
      <p className="text-sm">Choose whether to reach out. ECHO will never contact anyone automatically.</p>
      {contacts.map((contact) => (
        <div key={contact.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
          <span>{contact.contactName}</span>
          {contact.contactPhone && (
            <a className="echo-button-secondary" href={"tel:" + contact.contactPhone.replace(/[^\d+]/g, "")}>
              Call
            </a>
          )}
          {contact.contactEmail && (
            <a className="echo-button-secondary" href={"mailto:" + contact.contactEmail}>
              Email
            </a>
          )}
        </div>
      ))}
      {contacts.length === 0 && (
        <Link href="/settings/trusted-contacts" className="underline">
          Add a Trusted Support Contact
        </Link>
      )}
    </section>
  );
}

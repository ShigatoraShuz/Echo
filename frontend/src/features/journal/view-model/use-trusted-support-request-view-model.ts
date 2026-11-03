"use client";

import { useState } from "react";
import type { TrustedContact } from "@/features/settings/model/settings.model";
import { getTrustedSupportContacts, requestTrustedSupportContact } from "@/services/journal/trusted-support.service";

export function useTrustedSupportRequestViewModel(jobId: string) {
  const [contacts, setContacts] = useState<TrustedContact[] | null>(null);
  const [contactId, setContactId] = useState("");
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function choose() {
    setBusy(true);
    try {
      setContacts(await getTrustedSupportContacts());
    } catch {
      setNotice("Your trusted contacts could not be loaded. You can still contact someone you trust directly.");
    } finally {
      setBusy(false);
    }
  }

  async function request() {
    if (!consent || !contactId) return;
    setBusy(true);
    try {
      await requestTrustedSupportContact(jobId, contactId);
      setNotice("Your request is awaiting review. No one has been contacted. For urgent help, use the support numbers above.");
    } catch {
      setNotice("This request could not be approved. Check your contact permissions and account eligibility.");
    } finally {
      setBusy(false);
    }
  }

  return { contacts, contactId, setContactId, consent, setConsent, notice, busy, choose, request };
}

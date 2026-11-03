"use client";
import { useTrustedSupportRequestViewModel } from "../view-model/use-trusted-support-request-view-model";

export function TrustedSupportRequest({ jobId }: { jobId: string }) {
  const { contacts, contactId, setContactId, consent, setConsent, notice, busy, choose, request } = useTrustedSupportRequestViewModel(jobId);
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="font-semibold">Someone you trust</p>
      {contacts === null ? (
        <button
          type="button"
          disabled={busy}
          className="mt-2 font-semibold text-primary underline"
          onClick={() => void choose()}
        >
          Choose a trusted person
        </button>
      ) : contacts.length ? (
        <div className="mt-3 space-y-3">
          <label className="block">
            Trusted person
            <select
              value={contactId}
              onChange={(event) => setContactId(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-border bg-card p-2"
            >
              <option value="">Choose a contact</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.contactName} · {contact.relationship}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-1"
            />
            I request a reviewed support contact. My journal text will not be shared.
          </label>
          <button
            type="button"
            disabled={busy || !consent || !contactId}
            onClick={() => void request()}
            className="echo-button border border-border disabled:opacity-50"
          >
            Request review
          </button>
        </div>
      ) : (
        <p className="mt-2 text-muted-foreground">Add a trusted contact in Privacy settings when you are ready.</p>
      )}
      {notice ? (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

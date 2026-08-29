"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Loader2 } from "lucide-react";
import { registrationApi, type PolicyDocument } from "@/services/authentication/registration-api";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";
import { env } from "@/config/environment";
export default function PolicyUpdatePage() {
  const router = useRouter();
  const [policies, setPolicies] = useState<PolicyDocument[]>([]);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [active, setActive] = useState<PolicyDocument | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    registrationApi.policies().then(setPolicies);
  }, []);
  async function accept() {
    setBusy(true);
    const { data } = await createBrowserSupabaseClient().auth.getSession();
    const response = await fetch(`${env.apiBaseUrl}/access/policies`, {
      method: "POST",
      headers: { authorization: `Bearer ${data.session?.access_token ?? ""}`, "content-type": "application/json" },
      body: "{}",
    });
    setBusy(false);
    if (response.ok) {
      router.replace("/onboarding");
      router.refresh();
    }
  }
  const all = policies.length === 3 && policies.every((p) => reviewed.includes(p.id));
  return (
    <main className="grid min-h-[100svh] place-items-center bg-[#fbf8f1] p-4">
      <section className="w-full max-w-3xl rounded-[2rem] border border-[#526f3525] bg-white p-6 shadow-xl sm:p-9">
        <p className="eyebrow">Policy update</p>
        <h1 className="mt-2 text-4xl [font-family:var(--font-echo-display)]">Review what changed</h1>
        <p className="mt-3 text-sm text-[#697168]">Review each current document before returning to your ECHO space.</p>
        <div className="mt-6 grid gap-3">
          {policies.map((p) => (
            <button
              key={p.id}
              onClick={() => setActive(p)}
              className="flex min-h-16 items-center gap-3 rounded-2xl border border-[#526f3530] p-4 text-left"
            >
              <FileText className="size-5 text-[#526f35]" />
              <span className="flex-1">
                <strong className="block">{p.title}</strong>
                <small>Version {p.version}</small>
              </span>
              {reviewed.includes(p.id) && <Check className="size-5 text-[#526f35]" />}
            </button>
          ))}
        </div>
        <button disabled={!all || busy} onClick={accept} className="auth-primary w-full">
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Accept current policies"}
        </button>
      </section>
      {active && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#122018aa] p-3">
          <section
            role="dialog"
            aria-modal="true"
            className="flex max-h-[90svh] w-full max-w-2xl flex-col rounded-[2rem] bg-white p-6"
          >
            <h2 className="text-3xl [font-family:var(--font-echo-display)]">{active.title}</h2>
            <div
              onScroll={(e) => {
                const n = e.currentTarget;
                if (n.scrollTop + n.clientHeight >= n.scrollHeight - 8 && !reviewed.includes(active.id))
                  setReviewed((v) => [...v, active.id]);
              }}
              className="mt-4 min-h-0 flex-1 overflow-y-auto whitespace-pre-line text-sm leading-7 text-[#596255]"
            >
              {active.sanitized_markdown}
              <p className="mt-8 rounded-xl bg-[#edf2e7] p-4 font-bold">End of document</p>
            </div>
            <button
              disabled={!reviewed.includes(active.id)}
              onClick={() => setActive(null)}
              className="auth-primary w-full"
            >
              Acknowledge and close
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

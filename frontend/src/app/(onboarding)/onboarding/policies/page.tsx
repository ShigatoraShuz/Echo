"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Loader2 } from "lucide-react";
import { registrationApi, type PolicyDocument } from "@/services/authentication/registration-api";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";
import { env } from "@/config/environment";
import { PolicyReviewDialog } from "@/features/authentication/components/policy-review-dialog";
export default function PolicyUpdatePage() {
  const router = useRouter();
  const [policies, setPolicies] = useState<PolicyDocument[]>([]);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [active, setActive] = useState<PolicyDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  async function loadPolicies() {
    setLoading(true);
    setError(null);
    setReviewed([]);
    try {
      const documents = await registrationApi.policies();
      if (documents.length !== 3) throw new Error("The complete policy set is unavailable. Please retry.");
      setPolicies(documents);
    } catch {
      setError("The current documents could not be loaded. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void loadPolicies();
  }, []);
  async function accept() {
    if (!all || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await createBrowserSupabaseClient().auth.getSession();
      if (!data.session) throw new Error("Your session expired. Sign in again before accepting.");
      const response = await fetch(`${env.apiBaseUrl}/access/policies`, {
        method: "POST",
        headers: { authorization: `Bearer ${data.session.access_token}`, "content-type": "application/json" },
        body: JSON.stringify({ reviewedDocumentIds: policies.map((policy) => policy.id) }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 400
            ? "These policy versions could not be accepted. Reload the documents and review the current versions."
            : "Your acknowledgements could not be saved. Please retry.",
        );
      router.replace("/onboarding");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your acknowledgements could not be saved. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  const all = policies.length === 3 && policies.every((p) => reviewed.includes(p.id));
  return (
    <main className="grid min-h-[100svh] place-items-center bg-[#fbf8f1] p-4">
      <section className="w-full max-w-3xl rounded-[2rem] border border-[#526f3525] bg-white p-6 shadow-xl sm:p-9">
        <p className="eyebrow">Policy update</p>
        <h1 className="mt-2 text-4xl [font-family:var(--font-echo-display)]">Review what changed</h1>
        <p className="mt-3 text-sm text-[#697168]">Review each current document before returning to your ECHO space.</p>
        <p className="mt-2 text-sm leading-6 text-[#596255]">
          Acknowledging the AI notice does not enable analysis. Your optional analysis preference remains separate.
        </p>
        {loading && (
          <p role="status" className="mt-4 text-sm">
            Loading current documents…
          </p>
        )}
        {error && (
          <div role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">
            <p>{error}</p>
            <button
              type="button"
              disabled={busy || loading}
              onClick={() => void loadPolicies()}
              className="mt-3 min-h-11 font-semibold underline"
            >
              Reload documents
            </button>
          </div>
        )}
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
                <span className="my-1 block text-sm leading-6 text-[#596255]">{p.summary}</span>
                <small>Version {p.version}</small>
              </span>
              {reviewed.includes(p.id) && <Check className="size-5 text-[#526f35]" />}
            </button>
          ))}
        </div>
        <button disabled={!all || busy || loading} onClick={accept} className="auth-primary w-full">
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Accept current policies"}
        </button>
      </section>
      {active && (
        <PolicyReviewDialog
          key={active.id}
          policy={active}
          onAcknowledge={(id) => setReviewed((current) => (current.includes(id) ? current : [...current, id]))}
          onClose={() => setActive(null)}
        />
      )}
    </main>
  );
}

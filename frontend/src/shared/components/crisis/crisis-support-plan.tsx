"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supportResourcesApi, type SupportResource } from "@/services/support-resources/support-resources-api";
import snapshot from "@/services/support-resources/verified-resources.json";
import { TrustedSupport } from "./trusted-support";
export function CrisisSupportPlan() {
  const [resources, setResources] = useState<SupportResource[]>(snapshot),
    [offline, setOffline] = useState(false),
    [grounding, setGrounding] = useState(false);
  useEffect(() => {
    let active = true;
    void supportResourcesApi
      .list()
      .then((items) => {
        if (active && items.length) setResources(items);
      })
      .catch(() => {
        if (active) setOffline(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const primary =
    resources.find((r) => r.organizationName === "National Center for Mental Health" && r.phoneNumber === "1553") ??
    snapshot[0];
  const other =
    resources.find((r) => r.organizationName === "In Touch Community Services") ??
    snapshot.find((r) => r.organizationName === "In Touch Community Services")!;
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-primary/20 bg-secondary/40 p-5 sm:p-7">
        <p className="text-sm font-semibold text-primary">You&apos;re not alone</p>
        <h2 className="mt-2 font-serif text-3xl">Get immediate support</h2>
        <p className="my-4 text-sm leading-6">
          You deserve care and company through this moment. ECHO is not an emergency service and does not monitor
          crises. If there is immediate danger, seek emergency help now.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[primary, other].map((resource) => (
            <a
              key={resource.id}
              href={"tel:" + resource.phoneNumber?.replace(/[^\d+]/g, "")}
              className="echo-button-primary min-h-14 justify-center"
            >
              Call {resource.organizationName === "National Center for Mental Health" ? "NCMH" : "In Touch"} ·{" "}
              {resource.phoneNumber}
            </a>
          ))}
          <Link href="/support/find-help" className="echo-button-secondary min-h-12 justify-center">
            Professional resources
          </Link>
          <a href="tel:911" className="echo-button-secondary min-h-12 justify-center">
            Philippines emergency · 911
          </a>
        </div>
        <p className="mt-3 text-xs">These numbers serve the Philippines. Elsewhere, use your local emergency number.</p>
        {offline && (
          <p role="status" className="mt-3 text-xs">
            The live directory is unavailable. Showing the resource snapshot reviewed on 6 September 2026.
          </p>
        )}
      </section>
      <TrustedSupport />
      <section className="space-y-3 rounded-2xl border p-5">
        <h3 className="text-lg font-semibold">Ground yourself</h3>
        <p className="text-sm">
          If you can do so safely, move near someone you trust and put distance between yourself and anything you could
          use to hurt yourself.
        </p>
        <button className="echo-button-secondary" onClick={() => setGrounding((v) => !v)} aria-expanded={grounding}>
          Open grounding support
        </button>
        {grounding && (
          <p role="status" className="rounded-xl bg-secondary p-4">
            Feel your feet on the ground. Name five things you can see. Take one comfortable breath. Grounding can help
            while you reach support; it does not replace urgent care.
          </p>
        )}
      </section>
      <Link href="/support/find-help" className="block underline">
        View all crisis services and professional resources
      </Link>
    </div>
  );
}

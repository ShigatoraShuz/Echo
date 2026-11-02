"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  ChevronDown,
  HeartHandshake,
  Leaf,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { SupportAction } from "./support-action";

export interface SupportResource {
  id: string;
  resource_name: string;
  organization_name: string;
  phone_number?: string;
  sms_number?: string;
  website_url?: string;
  availability_text?: string;
}
const safePhone = (value?: string) =>
  value && /^[+\d\s().-]{3,40}$/.test(value) ? value : null;
const safeWebsite = (value?: string) => {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
};
export function JournalSupportPanel({
  resources,
  loading = false,
  failed = false,
  onRetry,
}: {
  resources: SupportResource[];
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
}) {
  // The server already orders verified active resources by display_priority. Never invent a contact.
  const priority = resources.find((resource) =>
    safePhone(resource.phone_number),
  );
  return (
    <div className="journal-support-panel mt-4 space-y-4 text-sm leading-6">
      <section
        className="support-priority-card"
        aria-label="Priority support options"
      >
        <div className="support-priority-halo" aria-hidden="true" />
        <p className="support-eyebrow">
          <span className="support-soft-dot" /> A person, a next step
        </p>
        <h3 className="support-serif-title">
          You don’t have to carry this alone.
        </h3>
        <p className="mt-3 text-sm leading-6 text-foreground/80">
          If you may be in immediate danger, contact local emergency services
          now. ECHO is not an emergency service.
        </p>
        {priority ? (
          <div className="support-phone-block">
            <div>
              <p className="support-eyebrow">Priority support contact</p>
              <p className="mt-1 text-sm font-semibold">
                {priority.resource_name}
              </p>
            </div>
            <a
              className="support-priority-phone"
              href={`tel:${safePhone(priority.phone_number)}`}
            >
              <Phone size={18} aria-hidden="true" />
              <span>{priority.phone_number}</span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            <p className="text-xs leading-5 text-muted-foreground">
              {priority.organization_name}
              {priority.availability_text
                ? ` · ${priority.availability_text}`
                : ""}
            </p>
          </div>
        ) : (
          <div className="support-phone-block">
            <p role="status" className="text-sm">
              {loading
                ? "Checking verified local support contacts…"
                : "Local contact details are not available right now."}
            </p>
            <Link
              href="/crisis-help"
              className="font-semibold text-primary underline underline-offset-4"
            >
              Open verified support options
            </Link>
            {failed && onRetry && (
              <button
                type="button"
                className="ml-3 font-semibold text-primary underline underline-offset-4"
                onClick={onRetry}
              >
                Try contacts again
              </button>
            )}
          </div>
        )}
        <SupportAction
          destination="professional"
          className="support-choice support-choice-primary"
        >
          <HeartHandshake size={20} aria-hidden="true" />
          <span>
            <strong>Talk to a professional</strong>
            <small>Explore support and request an appointment</small>
          </span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </SupportAction>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Requests are reviewed; a professional may not be available
          immediately. For urgent help, use a crisis or emergency service.
        </p>
      </section>
      <section className="support-grounding-card">
        <span className="support-icon-tile">
          <Leaf size={20} aria-hidden="true" />
        </span>
        <div>
          <h3 className="font-semibold">One gentle moment</h3>
          <p className="mt-1 text-muted-foreground">
            Feel your feet on the floor. Notice a few things around you. You can
            also move closer to someone you trust.
          </p>
        </div>
        <SupportAction
          destination="grounding"
          className="support-inline-action"
        >
          Open grounding exercises <ArrowUpRight size={15} aria-hidden="true" />
        </SupportAction>
        <p className="col-span-full text-xs text-muted-foreground">
          Grounding is optional and does not replace urgent support.
        </p>
      </section>
      {resources.length > 0 && (
        <details className="support-contact-details">
          <summary>
            <ShieldCheck size={17} aria-hidden="true" /> More verified contact
            options <span className="ml-auto text-xs">{resources.length}</span>
            <span className="support-contacts-toggle" aria-hidden="true">
              <span className="support-contacts-show">Show</span>
              <span className="support-contacts-hide">Hide</span>
              <ChevronDown size={18} />
            </span>
          </summary>
          <ul className="mt-3 space-y-3">
            {resources.map((resource) => (
              <li
                key={resource.id}
                className="rounded-2xl border border-primary/10 bg-card/80 p-4"
              >
                <p className="font-semibold">{resource.resource_name}</p>
                <p className="text-xs text-muted-foreground">
                  {resource.organization_name}
                  {resource.availability_text
                    ? ` · ${resource.availability_text}`
                    : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-4">
                  {safePhone(resource.phone_number) && (
                    <a
                      className="font-semibold text-primary underline"
                      href={`tel:${resource.phone_number}`}
                    >
                      Call {resource.phone_number}
                    </a>
                  )}
                  {safePhone(resource.sms_number) && (
                    <a
                      className="font-semibold text-primary underline"
                      href={`sms:${resource.sms_number}`}
                    >
                      Text
                    </a>
                  )}
                  {safeWebsite(resource.website_url) && (
                    <a
                      className="font-semibold text-primary underline"
                      href={safeWebsite(resource.website_url)!}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Website
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

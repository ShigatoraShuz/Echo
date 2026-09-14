import { HeartHandshake, MapPin, PhoneCall, ShieldAlert } from "lucide-react";

import { EchoCard } from "@/shared/components/layout";
import { PublicShell } from "@/shared/components/layout/echo-shells";
import { EchoImage, FeatureCard } from "@/shared/components/ui";

const crisisResources = [
  {
    name: "National Center for Mental Health Crisis Hotline",
    description: "National crisis support for people experiencing emotional distress or a mental health emergency.",
    availability: "24/7 crisis support",
    numbers: [
      {
        label: "1553",
        href: "tel:1553",
      },
      {
        label: "1800-1888-1553",
        href: "tel:180018881553",
      },
      {
        label: "0917-899-8727",
        href: "tel:+639178998727",
      },
      {
        label: "0966-351-4518",
        href: "tel:+639663514518",
      },
      {
        label: "0908-639-2672",
        href: "tel:+639086392672",
      },
    ],
    sourceLabel: "NCMH / Department of Health",
    source: "https://ncmh.gov.ph/images/pdf/docs/ncmhcovid19publicadvise5.pdf",
  },
  {
    name: "Hopeline Philippines",
    description: "Emotional crisis and suicide-prevention support available through landline and mobile numbers.",
    availability: "Crisis support",
    numbers: [
      {
        label: "(02) 8804-4673",
        href: "tel:+63288044673",
      },
      {
        label: "0917-558-4673",
        href: "tel:+639175584673",
      },
      {
        label: "0918-873-4673",
        href: "tel:+639188734673",
      },
      {
        label: "2919 (Globe/TM toll-free)",
        href: "tel:2919",
      },
    ],
    sourceLabel: "Quezon City Government",
    source: "https://quezoncity.gov.ph/national-suicide-prevention-week-4/",
  },
  {
    name: "In Touch Community Services",
    description: "Free and anonymous emotional crisis support from trained responders.",
    availability: "24/7 crisis line",
    numbers: [
      {
        label: "(02) 8893-7603",
        href: "tel:+63288937603",
      },
      {
        label: "0919-056-0709",
        href: "tel:+639190560709",
      },
      {
        label: "0917-800-1123",
        href: "tel:+639178001123",
      },
      {
        label: "0917-108-5412",
        href: "tel:+639171085412",
      },
    ],
    sourceLabel: "In Touch Community Services",
    source: "https://in-touch.org/contact-us/",
  },
  {
    name: "Cavite Center for Mental Health",
    description:
      "Local mental health services in Trece Martires City, Cavite. Contact the center for outpatient care and service availability.",
    availability: "Local mental health care",
    numbers: [
      {
        label: "(046) 419-0125 — Admin",
        href: "tel:+63464190125",
      },
      {
        label: "(046) 419-0013 — OPD",
        href: "tel:+63464190013",
      },
    ],
    sourceLabel: "Provincial Government of Cavite",
    source: "https://cavite.gov.ph/directory/",
  },
  {
    name: "Philippine Red Cross",
    description:
      "Nationwide emergency assistance. This is a general emergency hotline and is not presented as a dedicated mental health crisis line.",
    availability: "Emergency assistance",
    numbers: [
      {
        label: "143",
        href: "tel:143",
      },
    ],
    sourceLabel: "Philippine Red Cross",
    source: "https://redcross.org.ph/contact-us/",
  },
];

export default function CrisisHelpPage() {
  return (
    <PublicShell>
      <main className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 xl:px-10">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <section className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Immediate support</p>

              <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                You do not have to handle a crisis alone.
              </h1>

              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                If you may hurt yourself or someone else, or if there is immediate danger, contact emergency services or
                a crisis hotline now. ECHO is a wellness support tool and does not provide a medical diagnosis.
              </p>
            </div>

            <EchoCard
              title="If there is immediate danger"
              description="Call the Philippine Unified 911 Emergency Hotline or go to the nearest emergency department."
            >
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
                <div className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                  </div>

                  <div className="space-y-2">
                    <p className="font-semibold text-foreground">Philippine Unified Emergency Hotline</p>

                    <a
                      href="tel:911"
                      className="inline-flex text-2xl font-semibold text-destructive underline-offset-4 hover:underline"
                    >
                      Call 911
                    </a>

                    <p className="text-sm leading-6 text-muted-foreground">
                      Unified 911 connects callers to emergency medical, police, fire, rescue, and other emergency
                      responders nationwide.
                    </p>
                  </div>
                </div>
              </div>
            </EchoCard>

            <EchoImage imageKey="meditationRoomPlant" className="aspect-[4/3]" priority />
          </section>

          <section className="space-y-5">
            <div className="grid gap-5 md:grid-cols-3">
              <FeatureCard
                icon={<PhoneCall className="h-5 w-5" aria-hidden="true" />}
                title="NCMH 1553"
                description="National mental health crisis support available through the NCMH Crisis Hotline."
              />

              <FeatureCard
                icon={<HeartHandshake className="h-5 w-5" aria-hidden="true" />}
                title="Someone can listen"
                description="Hopeline and In Touch provide crisis and emotional support through Philippine hotlines."
              />

              <FeatureCard
                icon={<MapPin className="h-5 w-5" aria-hidden="true" />}
                title="Support in Cavite"
                description="Cavite Center for Mental Health provides local mental health services in Trece Martires."
              />
            </div>

            <EchoCard
              title="Philippine support directory"
              description="Choose the support that fits your situation. If there is immediate danger, call 911 first."
            >
              <div className="grid gap-4">
                {crisisResources.map((resource) => (
                  <article key={resource.name} className="rounded-2xl border border-border/70 bg-background p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{resource.name}</p>

                        <p className="text-xs font-medium uppercase tracking-wide text-primary">
                          {resource.availability}
                        </p>

                        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{resource.description}</p>
                      </div>

                      <PhoneCall
                        className="hidden h-5 w-5 shrink-0 text-muted-foreground sm:block"
                        aria-hidden="true"
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {resource.numbers.map((number) => (
                        <a
                          key={number.label}
                          href={number.href}
                          className="inline-flex min-h-10 items-center rounded-full border border-border bg-muted/40 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {number.label}
                        </a>
                      ))}
                    </div>

                    <p className="mt-4 text-xs leading-5 text-muted-foreground">
                      Source:{" "}
                      <a
                        href={resource.source}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
                      >
                        {resource.sourceLabel}
                      </a>
                    </p>
                  </article>
                ))}
              </div>
            </EchoCard>

            <p className="px-1 text-xs leading-5 text-muted-foreground">
              Hotline availability and contact details can change over time. ECHO provides these resources for support
              and referral purposes and does not replace professional or emergency care.
            </p>
          </section>
        </div>
      </main>
    </PublicShell>
  );
}

import { HeartHandshake, Leaf, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";

const defaultFooterGroups = [
  {
    title: "Reflect",
    links: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Private journal", href: "/journal" },
      { label: "Reflective Buddy", href: "/buddy" },
      { label: "Grounding tools", href: "/tools/grounding" },
    ],
  },
  {
    title: "Understand",
    links: [
      { label: "Emotion patterns", href: "/insights/emotion" },
      { label: "Distress signals", href: "/insights/risk" },
      { label: "Facial trend privacy", href: "/insights/facial" },
      { label: "Find professional help", href: "/support/find-help" },
    ],
  },
  {
    title: "Trust",
    links: [
      { label: "About ECHO", href: "/about" },
      { label: "Privacy policy", href: "/privacy-policy" },
      { label: "Terms of use", href: "/terms" },
      { label: "Crisis resources", href: "/crisis-help" },
    ],
  },
];

const landingFooterGroups = [
  {
    title: "Reflect",
    links: [
      { label: "Private journal", href: "/journal" },
      { label: "Reflective Buddy", href: "/buddy" },
      { label: "Grounding tools", href: "/tools/grounding" },
    ],
  },
  {
    title: "Understand",
    links: [
      { label: "Mood check-ins", href: "/journal/new" },
      { label: "Emotion patterns", href: "/insights/emotion" },
    ],
  },
  {
    title: "Trust",
    links: [
      { label: "About ECHO", href: "/about" },
      { label: "Privacy policy", href: "/privacy-policy" },
      { label: "Terms of use", href: "/terms" },
    ],
  },
];

interface EchoMarketingFooterProps {
  variant?: "default" | "landing";
}

export function EchoMarketingFooter({ variant = "default" }: EchoMarketingFooterProps) {
  const isLanding = variant === "landing";
  const footerGroups = isLanding ? landingFooterGroups : defaultFooterGroups;

  return (
    <footer
      className={isLanding
        ? "border-t border-white/10 bg-[var(--landing-footer)] text-[#f4f8f4] [font-family:var(--font-echo-sans)]"
        : "border-t border-white/10 bg-[#08180f] text-[#f4f8f4]"}
    >
      <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 sm:py-16 lg:px-8 xl:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_1.85fr] lg:gap-16">
          <div>
            <Link href="/" className="inline-flex items-center gap-3 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-white/20">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#8fc89a] text-[#102b1b] shadow-subtle">
                <Leaf className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className={isLanding ? "block text-xl font-extrabold tracking-[-0.04em]" : "block font-serif text-xl font-semibold"}>ECHO</span>
                <span className="block text-xs text-white/45">Your private wellness companion</span>
              </span>
            </Link>

            <p className="mt-5 max-w-md text-sm leading-6 text-white/60">
              {isLanding
                ? "A calm space for private journaling, guided reflection, mood check-ins, emotional patterns, and grounding tools."
                : "A calm space for private journaling, reflective prompts, emotional context, and grounding support—with user choice at the center."}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#f4f8f4] px-4 text-sm font-semibold text-[#102b1b] outline-none transition-transform duration-150 ease-out focus-visible:ring-4 focus-visible:ring-white/25 active:scale-[0.97]"
              >
                Start privately
              </Link>
              {!isLanding ? (
                <Link
                  href="/crisis-help"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white/75 outline-none transition-[transform,background-color,color] duration-150 ease-out hover:bg-white/10 hover:text-white focus-visible:ring-4 focus-visible:ring-white/20 active:scale-[0.97]"
                >
                  <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                  Crisis support
                </Link>
              ) : null}
            </div>
          </div>

          <nav className="grid grid-cols-2 gap-8 sm:grid-cols-3" aria-label="Footer navigation">
            {footerGroups.map((group) => (
              <div key={group.title}>
                <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8fc89a]">{group.title}</h2>
                <ul className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-sm text-white/60 outline-none transition-colors duration-150 hover:text-white focus-visible:text-white">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs leading-5 text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} ECHO. {isLanding ? "Private reflection, at your pace." : "Reflective support, not diagnosis."}
          </p>
          <p className="inline-flex items-center gap-2">
            {isLanding ? (
              <ShieldCheck className="h-3.5 w-3.5 text-[#8fc89a]" aria-hidden="true" />
            ) : (
              <HeartHandshake className="h-3.5 w-3.5 text-[#8fc89a]" aria-hidden="true" />
            )}
            {isLanding ? "Built around privacy and personal choice." : "If you may be in danger, contact emergency services now."}
          </p>
        </div>
      </div>
    </footer>
  );
}

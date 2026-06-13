import Link from "next/link";

const links = [
  { href: "/about", label: "About" },
  { href: "/privacy-policy", label: "Privacy" },
  { href: "/crisis-help", label: "Crisis help" },
  { href: "/terms", label: "Terms" },
];

export function EchoPublicFooter() {
  return (
    <footer className="border-t border-border/70 bg-secondary/20">
      <div className="mx-auto grid max-w-[1440px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_auto] lg:px-8 xl:px-10">
        <div className="space-y-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground">
              E
            </span>
            <span className="text-sm font-semibold text-foreground">ECHO</span>
          </Link>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            Private journaling, reflective Buddy support, and wellbeing signals. ECHO is not a diagnostic tool.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

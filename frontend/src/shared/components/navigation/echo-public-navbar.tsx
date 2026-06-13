import Link from "next/link";

const links = [
  { href: "/about", label: "About" },
  { href: "/privacy-policy", label: "Privacy" },
  { href: "/crisis-help", label: "Crisis help" },
];

export function EchoPublicNavbar() {
  return (
    <header className="border-b border-border/70 bg-background/90">
      <nav className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8 xl:px-10">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-subtle">
            E
          </span>
          <span className="text-sm font-semibold text-foreground">ECHO</span>
        </Link>

        <div className="hidden items-center gap-2 md:flex">
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

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-foreground transition hover:bg-muted"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-subtle transition hover:bg-primary/90 focus-visible:ring-4 focus-visible:ring-ring/20"
          >
            Start
          </Link>
        </div>
      </nav>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, BriefcaseBusiness, ClipboardList, Home, Settings2 } from "lucide-react";
import type { ReactNode } from "react";

const professionalLinks = [
  { href: "/professional", label: "Overview", icon: Home },
  { href: "/professional/requests", label: "Requests", icon: ClipboardList },
  { href: "/professional/cases", label: "My cases", icon: BriefcaseBusiness },
  { href: "/professional/settings", label: "Settings", icon: Settings2 },
];

export default function ProfessionalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#fcfaf6] text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <aside className="hidden w-64 shrink-0 border-r border-black/5 bg-white/70 px-5 py-7 md:flex md:flex-col">
          <Link href="/professional" className="mb-10 flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#8fc89a] text-[#0d211a]">
              <BookOpen className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-lg font-black tracking-tight">ECHO</span>
              <span className="block text-xs text-muted-foreground">Professional workspace</span>
            </span>
          </Link>
          <nav aria-label="Professional navigation" className="space-y-2">
            {professionalLinks.map(({ href, label, icon: Icon }) => {
              const active = href === "/professional" ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? "bg-[#8fc89a] text-[#0d211a]" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-black/5 pt-5">
            <Link href="/dashboard" className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Return to User Side
            </Link>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-black/5 bg-[#fcfaf6]/90 px-4 backdrop-blur-md sm:px-8">
            <Link href="/professional" className="font-black tracking-tight md:hidden">ECHO <span className="font-medium text-muted-foreground">Professional</span></Link>
            <span className="hidden text-sm text-muted-foreground md:block">Professional workspace</span>
            <Link href="/dashboard" className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              User Side
            </Link>
          </header>
          <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">{children}</main>
        </div>
      </div>
    </div>
  );
}

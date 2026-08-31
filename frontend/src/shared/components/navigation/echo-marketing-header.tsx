"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Leaf, Menu, ShieldAlert, X } from "lucide-react";
import { cn } from "@/shared/lib/utils";

const navLinks = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/about", label: "About" },
  { href: "/privacy-policy", label: "Privacy" },
];

export function EchoMarketingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Shrink shadow slightly when user has not scrolled
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* ── Desktop Island ─────────────────────────────────────────────── */}
      <header
        aria-label="Main navigation"
        className={cn(
          // Island positioning — fixed, centred, floating above content
          "fixed left-1/2 top-5 z-[1000] hidden -translate-x-1/2 md:block",
          // Island sizing
          "w-[90%] max-w-[1200px]",
          // Island pill shape
          "rounded-[50px]",
          // Glassmorphic fill — uses landing-cream token at 92% opacity
          "bg-[rgba(251,247,238,0.92)] backdrop-blur-[10px]",
          // Elevation
          scrolled
            ? "shadow-[0_8px_32px_rgba(0,0,0,0.10)]"
            : "shadow-[0_4px_20px_rgba(0,0,0,0.06)]",
          // Subtle rim
          "border border-[var(--landing-sand)]/60",
          "transition-shadow duration-300"
        )}
      >
        <div className="flex h-[68px] items-center justify-between px-7">

          {/* Brand */}
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2.5 rounded-full outline-none focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--landing-primary)] text-[var(--landing-inverse)] shadow-sm transition-transform duration-150 group-hover:scale-105">
              <Leaf className="h-4.5 w-4.5" strokeWidth={2.5} aria-hidden="true" />
            </span>
            <span
              className="text-lg font-extrabold tracking-[-0.04em] text-[var(--landing-ink)]"
              style={{ fontFamily: "var(--font-echo-sans, inherit)" }}
            >
              ECHO
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-0.5" aria-label="Site links">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium",
                  "text-[var(--landing-muted)] outline-none",
                  "transition-colors duration-150",
                  "hover:bg-[var(--landing-primary-10)] hover:text-[var(--landing-ink)]",
                  "focus-visible:ring-2 focus-visible:ring-[var(--landing-primary-20)]"
                )}
              >
                {item.label}
              </Link>
            ))}

            {/* Crisis support — accent red */}
            <Link
              href="/crisis"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-wider",
                "text-[#c0504e] outline-none",
                "transition-colors duration-150 hover:bg-red-50",
                "focus-visible:ring-2 focus-visible:ring-red-400/30"
              )}
            >
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              Crisis
            </Link>
          </nav>

          {/* CTAs */}
          <div className="flex shrink-0 items-center gap-2.5">
            <Link
              href="/login"
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-full px-5",
                "text-sm font-semibold text-[var(--landing-ink)]",
                "border border-[var(--landing-sand)]",
                "transition-colors duration-150 hover:bg-[var(--landing-primary-10)]",
                "outline-none focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] active:scale-[0.98]"
              )}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-full px-5",
                "text-sm font-bold text-[var(--landing-inverse)]",
                "bg-[var(--landing-primary)]",
                "transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--landing-primary-hover)]",
                "shadow-sm outline-none focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] active:scale-[0.98]"
              )}
            >
              Start privately
            </Link>
          </div>
        </div>
      </header>

      {/* ── Mobile Island ──────────────────────────────────────────────── */}
      <header
        aria-label="Main navigation"
        className={cn(
          "fixed left-1/2 top-4 z-[1000] -translate-x-1/2 md:hidden",
          "w-[92%] max-w-[480px]",
          "rounded-[50px]",
          "bg-[rgba(251,247,238,0.92)] backdrop-blur-[10px]",
          scrolled
            ? "shadow-[0_8px_32px_rgba(0,0,0,0.10)]"
            : "shadow-[0_4px_20px_rgba(0,0,0,0.06)]",
          "border border-[var(--landing-sand)]/60",
          "transition-all duration-300"
        )}
      >
        <div className="flex h-[60px] items-center justify-between px-5">
          {/* Brand */}
          <Link href="/" className="group flex items-center gap-2 rounded-full outline-none">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--landing-primary)] text-[var(--landing-inverse)]">
              <Leaf className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            </span>
            <span className="text-base font-extrabold tracking-[-0.04em] text-[var(--landing-ink)]">
              ECHO
            </span>
          </Link>

          {/* Hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((p) => !p)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--landing-ink)] hover:bg-[var(--landing-primary-10)]"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile drawer — expands within the island pill */}
        {mobileMenuOpen && (
          <div className="border-t border-[var(--landing-sand)]/50 px-5 pb-5 pt-3">
            <nav className="flex flex-col gap-0.5">
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-2xl px-4 py-2.5 text-sm font-medium text-[var(--landing-muted)] hover:bg-[var(--landing-primary-10)] hover:text-[var(--landing-ink)]"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/crisis"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-[#c0504e] hover:bg-red-50"
              >
                <ShieldAlert className="h-4 w-4" />
                Crisis Support
              </Link>
            </nav>
            <div className="mt-3 flex flex-col gap-2 border-t border-[var(--landing-sand)]/50 pt-3">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 items-center justify-center rounded-full border border-[var(--landing-sand)] text-sm font-semibold text-[var(--landing-ink)]"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 items-center justify-center rounded-full bg-[var(--landing-primary)] text-sm font-bold text-[var(--landing-inverse)] shadow-sm"
              >
                Start privately
              </Link>
            </div>
          </div>
        )}
      </header>


    </>
  );
}

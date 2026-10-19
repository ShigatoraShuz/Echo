"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLenis } from "lenis/react";
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
  const [menuReady, setMenuReady] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeHash, setActiveHash] = useState("");
  const pathname = usePathname();
  const lenis = useLenis();
  const scrollSentinelRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  const isActiveLink = (href: string) => {
    if ((href === "/about" || href === "/privacy-policy") && pathname === href) return true;
    const hash = href.startsWith("/#") ? href.slice(1) : "";
    return pathname === "/" && Boolean(hash) && activeHash === hash;
  };

  useEffect(() => setMenuReady(true), []);

  useEffect(() => {
    const sentinel = scrollSentinelRef.current;
    if (!sentinel) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), {
      rootMargin: "-36px 0px 0px 0px",
      threshold: 0,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => setMobileMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileMenuOpen(false);
      mobileMenuButtonRef.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen]);

  useEffect(() => {
    let frame = 0;
    let timer = 0;
    const onHashChange = () => {
      const hash = window.location.hash;
      setActiveHash(hash);
      if (pathname !== "/" || (hash !== "#features" && hash !== "#how-it-works")) return;
      let attempts = 0;
      const alignTarget = () => {
        const target = document.getElementById(hash.slice(1));
        if (!target) {
          if (attempts++ < 120) frame = window.requestAnimationFrame(alignTarget);
          return;
        }
        timer = window.setTimeout(() => {
          const top = window.scrollY + target.getBoundingClientRect().top - (window.innerWidth < 1024 ? 96 : 104);
          if (lenis) lenis.scrollTo(top, { immediate: true });
          else window.scrollTo({ top, behavior: "instant" });
        }, 80);
      };
      frame = window.requestAnimationFrame(alignTarget);
    };
    onHashChange();
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [pathname, lenis]);

  return (
    <>
      <div ref={scrollSentinelRef} className="pointer-events-none absolute inset-x-0 top-0 h-px" aria-hidden="true" />
      <header
        aria-label="Main navigation"
        className={cn(
          "fixed left-1/2 top-0 z-[1000] hidden -translate-x-1/2 lg:block",
          "bg-[rgba(251,247,238,0.94)] backdrop-blur-[14px]",
          "border border-[var(--landing-sand)]/60",
          "will-change-[width,max-width,border-radius,transform] transition-[width,max-width,border-radius,box-shadow,background-color,border-color,transform] duration-[480ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
          scrolled
            ? "w-[min(92%,1380px)] translate-y-4 rounded-[2rem] shadow-[0_20px_56px_rgba(38,50,31,0.18),0_3px_12px_rgba(38,50,31,0.08)]"
            : "w-full translate-y-0 rounded-none border-x-transparent border-t-transparent shadow-[0_6px_24px_rgba(49,55,36,0.09)]",
        )}
      >
        <div className="mx-auto flex h-20 w-full max-w-[1380px] items-center justify-between px-5 xl:px-10">
          {/* Brand */}
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-3 rounded-full outline-none transition-transform duration-150 focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] active:scale-[0.97]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--landing-primary)] text-[var(--landing-inverse)] shadow-sm transition-transform duration-150 group-hover:scale-105">
              <Leaf className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
            </span>
            <span
              className="text-[1.35rem] font-extrabold tracking-[-0.04em] text-[var(--landing-ink)]"
              style={{ fontFamily: "var(--font-echo-sans, inherit)" }}
            >
              ECHO
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-0.5" aria-label="Site links">
            {navLinks.map((item) => {
              const NavLink = item.href.startsWith("/#") ? "a" : Link;
              return <NavLink
                key={item.href}
                href={item.href}
                aria-current={isActiveLink(item.href) ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-2.5 text-sm font-semibold xl:px-4 xl:text-[15px]",
                  "text-[var(--landing-muted)] outline-none",
                  "transition-colors duration-150",
                  "hover:bg-[var(--landing-primary-10)] hover:text-[var(--landing-ink)]",
                  "focus-visible:ring-2 focus-visible:ring-[var(--landing-primary-20)]",
                  isActiveLink(item.href) &&
                    "bg-[var(--landing-primary-10)] text-[var(--landing-ink)] ring-1 ring-inset ring-[var(--landing-primary-20)]",
                )}
              >
                {item.label}
              </NavLink>;
            })}

            {/* Crisis support — accent red */}
            <Link
              href="/crisis"
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-2.5 text-xs font-bold uppercase tracking-[0.08em] xl:px-4",
                "text-[#c0504e] outline-none",
                "transition-colors duration-150 hover:bg-red-50",
                "focus-visible:ring-2 focus-visible:ring-red-400/30",
              )}
            >
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              Crisis
            </Link>
          </nav>

          {/* CTAs */}
          <div className="flex shrink-0 items-center gap-2 xl:gap-3">
            <Link
              href="/login"
              className={cn(
                "inline-flex h-11 items-center justify-center rounded-full px-4 xl:px-5",
                "text-sm font-semibold text-[var(--landing-ink)]",
                "border border-[var(--landing-sand)]",
                "transition-[background-color,transform] duration-150 hover:bg-[var(--landing-primary-10)]",
                "outline-none focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] active:scale-[0.98]",
              )}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className={cn(
                "inline-flex h-11 items-center justify-center rounded-full px-5 xl:px-6",
                "text-sm font-bold text-[var(--landing-inverse)]",
                "bg-[var(--landing-primary)]",
                "transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--landing-primary-hover)]",
                "shadow-sm outline-none focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] active:scale-[0.98]",
              )}
            >
              Start privately
            </Link>
          </div>
        </div>
      </header>

      <header
        aria-label="Main navigation"
        className={cn(
          "fixed left-1/2 top-0 z-[1000] -translate-x-1/2 lg:hidden",
          "bg-[rgba(251,247,238,0.94)] backdrop-blur-[14px]",
          "border border-[var(--landing-sand)]/60",
          "will-change-[width,max-width,border-radius,transform] transition-[width,max-width,border-radius,box-shadow,background-color,border-color,transform] duration-[480ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
          scrolled
            ? "w-[calc(100%-1.5rem)] max-w-[520px] translate-y-3 rounded-[2rem] shadow-[0_18px_48px_rgba(38,50,31,0.17),0_3px_10px_rgba(38,50,31,0.07)]"
            : "w-full max-w-[100vw] translate-y-0 rounded-none border-x-transparent border-t-transparent shadow-[0_6px_24px_rgba(49,55,36,0.09)]",
        )}
      >
        <div className="flex h-[72px] items-center justify-between px-5">
          {/* Brand */}
          <Link href="/" className="group flex items-center gap-2 rounded-full outline-none">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--landing-primary)] text-[var(--landing-inverse)]">
              <Leaf className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
            </span>
            <span className="text-xl font-extrabold tracking-[-0.04em] text-[var(--landing-ink)]">ECHO</span>
          </Link>

          {/* Hamburger */}
          <button
            ref={mobileMenuButtonRef}
            type="button"
            disabled={!menuReady}
            onClick={() => setMobileMenuOpen((p) => !p)}
            aria-expanded={mobileMenuOpen}
            aria-controls="echo-marketing-mobile-menu"
            aria-label="Toggle navigation"
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--landing-ink)] transition-[background-color,transform] duration-150 hover:bg-[var(--landing-primary-10)] active:scale-[0.97]"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile drawer — expands within the island pill */}
        {mobileMenuOpen && (
          <div id="echo-marketing-mobile-menu" className="border-t border-[var(--landing-sand)]/50 px-5 pb-5 pt-3">
            <nav className="flex flex-col gap-0.5" aria-label="Mobile navigation">
              {navLinks.map((item) => {
                const NavLink = item.href.startsWith("/#") ? "a" : Link;
                return <NavLink
                  key={item.href}
                  href={item.href}
                  aria-current={isActiveLink(item.href) ? "page" : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "rounded-2xl px-4 py-3 text-base font-medium text-[var(--landing-muted)] hover:bg-[var(--landing-primary-10)] hover:text-[var(--landing-ink)]",
                    isActiveLink(item.href) && "bg-[var(--landing-primary-10)] font-semibold text-[var(--landing-ink)]",
                  )}
                >
                  {item.label}
                </NavLink>;
              })}
              <Link
                href="/crisis"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-2xl px-4 py-3 text-base font-semibold text-[#c0504e] hover:bg-red-50"
              >
                <ShieldAlert className="h-4 w-4" />
                Crisis Support
              </Link>
            </nav>
            <div className="mt-3 flex flex-col gap-2 border-t border-[var(--landing-sand)]/50 pt-3">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-12 items-center justify-center rounded-full border border-[var(--landing-sand)] text-base font-semibold text-[var(--landing-ink)]"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-12 items-center justify-center rounded-full bg-[var(--landing-primary)] text-base font-bold text-[var(--landing-inverse)] shadow-sm"
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

"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/utils";

interface EchoPageFadeProps {
  children: ReactNode;
  className?: string;
  duration?: number;
}

/** A restrained route entrance plus semantic, once-only scroll reveals. */
export function EchoPageFade({ children, className, duration = 420 }: EchoPageFadeProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const selector = "main section, main article, main [data-echo-reveal-auto]";
    const observed = new WeakSet<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute("data-echo-auto-visible", "true");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -7% 0px", threshold: 0.08 },
    );

    const register = () => {
      document.querySelectorAll(selector).forEach((element) => {
        if (
          observed.has(element) ||
          element.closest("[data-echo-reveal]") ||
          element.querySelector("[data-echo-reveal]") ||
          element.hasAttribute("data-echo-reveal-skip")
        )
          return;
        observed.add(element);
        element.setAttribute("data-echo-auto-reveal", "true");
        observer.observe(element);
      });
    };

    register();
    const mutations = new MutationObserver(register);
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      mutations.disconnect();
      observer.disconnect();
    };
  }, [pathname]);

  return (
    <div key={pathname} className={cn("echo-page-fade", className)} style={{ animationDuration: `${duration}ms` }}>
      {children}
    </div>
  );
}

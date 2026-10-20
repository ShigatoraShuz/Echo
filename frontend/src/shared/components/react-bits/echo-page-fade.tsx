"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/utils";
import { shouldReduceMotion } from "@/shared/hooks/use-prefers-reduced-motion";

interface EchoPageFadeProps {
  children: ReactNode;
  className?: string;
  duration?: number;
}

/** A restrained route entrance plus semantic, once-only scroll reveals. */
export function EchoPageFade({ children, className, duration = 220 }: EchoPageFadeProps) {
  const pathname = usePathname();
  const isImmediateSupportRoute = pathname === "/crisis";

  useEffect(() => {
    if (isImmediateSupportRoute) return;
    if (shouldReduceMotion()) return;

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
          element.closest("[data-echo-app-shell]") ||
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
  }, [isImmediateSupportRoute, pathname]);

  return (
    <div
      className={cn(!isImmediateSupportRoute && "echo-page-fade", className)}
      style={isImmediateSupportRoute ? undefined : { animationDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
}

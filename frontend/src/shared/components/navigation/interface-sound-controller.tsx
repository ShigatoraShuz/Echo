"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  INTERFACE_SOUND_EVENT,
  INTERFACE_SOUND_KEY,
  interfaceSoundPreference,
  playInterfaceSound,
  stopInterfaceSound,
  unlockInterfaceSound,
} from "@/services/audio/interface-sound";

export function InterfaceSoundController() {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current !== pathname) void playInterfaceSound("page");
    previousPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const unlock = (event: Event) => {
      if (event.isTrusted) void unlockInterfaceSound();
    };
    const silence = () => stopInterfaceSound();
    const onVisibility = () => {
      if (document.hidden) silence();
    };
    const preferenceChanged = () => {
      const preference = interfaceSoundPreference();
      if (!preference.enabled || preference.volume === 0) silence();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === INTERFACE_SOUND_KEY || event.key === null) preferenceChanged();
    };
    let open = new Set<Element>();
    let frame = 0;
    const scan = (announce: boolean) => {
      const next = new Set(
        Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog[open]')).filter(
          (element) => {
            if (
              element.closest('[hidden], [inert], [aria-hidden="true"], [data-state="closed"], [data-state="closing"]')
            )
              return false;
            const style = getComputedStyle(element);
            return element.getClientRects().length > 0 && style.visibility !== "hidden" && style.display !== "none";
          },
        ),
      );
      if (announce && Array.from(next).some((element) => !open.has(element))) void playInterfaceSound("popup");
      open = next;
    };
    scan(false);
    const observer = new MutationObserver((records) => {
      if (
        records.some(
          (record) =>
            record.attributeName === "aria-selected" &&
            record.target instanceof Element &&
            record.target.getAttribute("role") === "tab" &&
            record.target.getAttribute("aria-selected") === "true",
        )
      ) {
        void playInterfaceSound("page");
      }
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          scan(true);
        });
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "inert", "aria-hidden", "open", "data-state", "aria-selected"],
    });
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(INTERFACE_SOUND_EVENT, preferenceChanged);
    window.addEventListener("storage", onStorage);
    window.addEventListener("echo:sensitive-state-cleared", silence);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(INTERFACE_SOUND_EVENT, preferenceChanged);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("echo:sensitive-state-cleared", silence);
      silence();
    };
  }, []);
  return null;
}

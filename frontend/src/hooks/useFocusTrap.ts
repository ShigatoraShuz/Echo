import { useEffect, useCallback, useRef } from "react";

export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Tab" || !containerRef.current) return;
    const focusable = containerRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    const el = containerRef.current;
    el?.addEventListener("keydown", handleKeyDown);
    return () => el?.removeEventListener("keydown", handleKeyDown);
  }, [isActive, handleKeyDown]);

  return containerRef;
}

import { useSyncExternalStore, type AnchorHTMLAttributes } from "react";
const subscribe = (callback: () => void) => { window.addEventListener("popstate", callback); return () => window.removeEventListener("popstate", callback); };
const snapshot = () => window.location.href;
function navigate(href: string, replace = false) { if (replace) history.replaceState(null, "", href); else history.pushState(null, "", href); window.dispatchEvent(new PopStateEvent("popstate")); }
const router = { push: (href: string) => navigate(href), replace: (href: string) => navigate(href, true), refresh: () => undefined };
export const useRouter = () => router;
export function usePathname() { return new URL(useSyncExternalStore(subscribe, snapshot)).pathname; }
export function useSearchParams() { return new URL(useSyncExternalStore(subscribe, snapshot)).searchParams; }
export default function Link({ href = "", onNavigate, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { onNavigate?: () => void }) {
  return <a {...props} href={href} onClick={(event) => { onClick?.(event); if (!event.defaultPrevented && href.startsWith("/") && !event.ctrlKey && !event.metaKey) { event.preventDefault(); onNavigate?.(); navigate(href); } }} />;
}

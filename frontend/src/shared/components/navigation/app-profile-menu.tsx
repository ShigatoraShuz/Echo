"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  Bell,
  BadgeCheck,
  ChevronDown,
  LoaderCircle,
  LogOut,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";

import { getAuthService } from "@/services/authentication/auth-service.factory";
import { settingsService } from "@/services/settings/settings.service";

const profileLinks = [
  { href: "/settings/profile#profile-overview", label: "Profile", icon: UserRound },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/settings/verification", label: "Account verification", icon: BadgeCheck },
  { href: "/settings/profile#personal-details", label: "Profile settings", icon: SlidersHorizontal },
  { href: "/settings/privacy", label: "Privacy", icon: ShieldCheck },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
];

export function AppProfileMenu() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [displayName, setDisplayName] = useState("Mira");
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [openedWithKeyboard, setOpenedWithKeyboard] = useState(false);
  const [pendingFocusIndex, setPendingFocusIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<Array<HTMLAnchorElement | HTMLButtonElement | null>>([]);
  const menuId = useId();

  const logOut = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setLogoutError(null);

    try {
      const result = await getAuthService().logout();
      if (!result.success) {
        setLogoutError(result.error.message || "We could not log you out. Please try again.");
        setIsLoggingOut(false);
        return;
      }

      setIsOpen(false);
      router.replace("/login");
      router.refresh();
    } catch {
      setLogoutError("We could not log you out. Please check your connection and try again.");
      setIsLoggingOut(false);
    }
  };

  const closeMenu = (restoreFocus = false) => {
    setIsOpen(false);
    setLogoutError(null);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  const openMenu = (fromKeyboard: boolean, focusIndex?: number) => {
    setOpenedWithKeyboard(fromKeyboard);
    setLogoutError(null);
    setIsOpen(true);
    setPendingFocusIndex(focusIndex ?? null);
  };

  useLayoutEffect(() => {
    if (!isOpen || pendingFocusIndex === null) return;
    menuItemRefs.current[pendingFocusIndex]?.focus();
    setPendingFocusIndex(null);
  }, [isOpen, pendingFocusIndex]);

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    openMenu(true, event.key === "ArrowDown" ? 0 : profileLinks.length);
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const activeIndex = menuItemRefs.current.findIndex((item) => item === document.activeElement);
    let nextIndex: number | null = null;

    if (event.key === "ArrowDown") {
      nextIndex = activeIndex < profileLinks.length ? activeIndex + 1 : 0;
    } else if (event.key === "ArrowUp") {
      nextIndex = activeIndex <= 0 ? profileLinks.length : activeIndex - 1;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = profileLinks.length;
    } else if (event.key === "Tab") {
      closeMenu();
      return;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      menuItemRefs.current[nextIndex]?.focus();
    }
  };

  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void settingsService
      .get()
      .then((settings) => {
        if (active) {
          setDisplayName(settings.profile.displayName);
          setAvatar(settings.profile.avatarPath ?? null);
        }
      })
      .catch(() => {
        // Keep the friendly fallback name if profile settings are unavailable.
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const closeOnOutsidePress = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setLogoutError(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        setLogoutError(null);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };

    document.addEventListener("mousedown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (isOpen) closeMenu();
          else openMenu(false);
        }}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={`Profile menu for ${displayName}`}
        className="flex items-center gap-2 rounded-full p-1 outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.97]"
      >
        {avatar ? (
          <img src={avatar} alt={`${displayName}'s profile`} className="h-9 w-9 rounded-full border-2 border-card object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-card bg-primary/10 text-xs font-bold text-primary">
            {initials || <UserRound className="h-4 w-4" />}
          </div>
        )}
        <ChevronDown className={`hidden h-4 w-4 text-muted-foreground transition-transform duration-150 sm:block ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        <span className="sr-only">Open profile menu</span>
      </button>

      {isOpen ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          onKeyDown={handleMenuKeyDown}
          className={`absolute right-0 top-[calc(100%+0.7rem)] z-[200] w-60 origin-top-right rounded-2xl border border-border/70 bg-card/95 p-2 shadow-[0_18px_46px_rgba(23,45,37,0.18)] backdrop-blur-xl motion-reduce:animate-none ${
            openedWithKeyboard ? "" : "[animation:echo-profile-menu-in_180ms_cubic-bezier(0.23,1,0.32,1)]"
          }`}
        >
          <div className="border-b border-border/65 px-3 pb-3 pt-2">
            <p className="text-sm font-semibold text-foreground">{displayName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Your private ECHO space</p>
          </div>
          <div className="py-1.5">
            {profileLinks.map((item, index) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  ref={(element: HTMLAnchorElement | null) => {
                    menuItemRefs.current[index] = element;
                  }}
                  href={item.href}
                  role="menuitem"
                  onClick={() => closeMenu()}
                  className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-foreground outline-none transition-colors duration-150 hover:bg-secondary focus-visible:bg-secondary"
                >
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="border-t border-border/65 pt-1.5">
            <button
              ref={(element) => {
                menuItemRefs.current[profileLinks.length] = element;
              }}
              type="button"
              role="menuitem"
              onClick={() => void logOut()}
              disabled={isLoggingOut}
              className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-danger outline-none transition-colors duration-150 hover:bg-danger/10 focus-visible:bg-danger/10 disabled:cursor-wait disabled:opacity-65"
            >
              {isLoggingOut ? (
                <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <LogOut className="h-4 w-4" aria-hidden="true" />
              )}
              {isLoggingOut ? "Logging out…" : "Log out"}
            </button>
            {logoutError ? (
              <p role="alert" className="px-3 pb-1 pt-2 text-xs leading-5 text-danger">
                {logoutError}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BookOpen, LayoutDashboard, Leaf, MessageCircleHeart, PenLine } from "lucide-react";
import { AppProfileMenu } from "./app-profile-menu";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/buddy", label: "Reflect", icon: MessageCircleHeart },
];

export function AppTopbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-[100] border-b border-border/65 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[76px] max-w-[1440px] items-center gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2 rounded-full text-primary outline-none focus-visible:ring-4 focus-visible:ring-ring/20 lg:hidden">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-subtle">
            <Leaf className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="hidden text-lg font-bold tracking-[-0.04em] sm:block">ECHO</span>
        </Link>

        <nav className="flex min-w-0 items-center gap-0.5 sm:gap-1 lg:hidden" aria-label="App navigation">
          {links.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex h-10 items-center gap-2 rounded-full px-2.5 text-sm font-medium outline-none transition-[background-color,color,transform] duration-150 ease-out hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.97] sm:px-4 ${
                  active ? "bg-secondary text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Link href="/journal/new" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-subtle outline-none transition-[background-color,transform,box-shadow] duration-150 ease-out hover:bg-primary/90 hover:shadow-card focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.97] sm:px-4">
            <PenLine className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Write reflection</span>
          </Link>
          <button type="button" className="relative grid h-10 w-10 place-items-center rounded-full border border-border/70 bg-card text-muted-foreground outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.97]" aria-label="Notifications">
            <Bell className="h-4 w-4" aria-hidden="true" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-card" />
          </button>
          <AppProfileMenu />
        </div>
      </div>
    </header>
  );
}

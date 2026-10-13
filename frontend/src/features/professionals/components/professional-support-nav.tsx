"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Clock3, Compass, LayoutDashboard, MessageCircle, MessagesSquare } from "lucide-react";
import { ROUTES } from "@/config/routes.config";

const links = [
  { href: ROUTES.professionalSupport.index, label: "Overview", icon: LayoutDashboard, exact: true },
  { href: ROUTES.professionalSupport.discover, label: "Find Professionals", icon: Compass },
  { href: ROUTES.professionalSupport.requests, label: "My Requests", icon: MessagesSquare },
  { href: ROUTES.professionalSupport.messages, label: "Messages", icon: MessageCircle },
  { href: ROUTES.professionalSupport.appointments, label: "Appointments", icon: CalendarDays },
  { href: ROUTES.professionalSupport.history, label: "Support History", icon: Clock3 },
];

export function ProfessionalSupportNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Professional support sections"
      className="mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-card/80 p-1.5 shadow-subtle"
    >
      {links.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-bold transition-[background-color,color,transform] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-4 ${
              active ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-secondary"
            }`}
          >
            <Icon size={15} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

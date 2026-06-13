"use client";

import { cn } from "@/lib/utils";

export interface EchoTab {
  value: string;
  label: string;
  badge?: React.ReactNode;
  disabled?: boolean;
}

interface EchoTabsProps {
  tabs: EchoTab[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function EchoTabs({ tabs, value, onChange, className }: EchoTabsProps) {
  return (
    <div
      className={cn("flex flex-wrap gap-1 rounded-xl bg-muted p-1", className)}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => onChange(tab.value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20",
              isActive
                ? "bg-background text-foreground shadow-subtle"
                : "text-muted-foreground hover:text-foreground",
              tab.disabled && "cursor-not-allowed opacity-50"
            )}
          >
            {tab.label}
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}

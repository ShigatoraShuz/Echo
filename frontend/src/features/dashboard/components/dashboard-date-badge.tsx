"use client";

export function DashboardDateBadge() {
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return <p className="text-xs font-medium text-muted-foreground">{date}</p>;
}

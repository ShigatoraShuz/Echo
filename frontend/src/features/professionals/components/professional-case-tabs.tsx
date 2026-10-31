"use client";
import { useId, useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import { LayoutDashboard, MessageCircle, CalendarDays, NotebookPen, History } from "lucide-react";
const sections = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "conversation", label: "Conversation", icon: MessageCircle },
  { id: "appointments", label: "Appointments", icon: CalendarDays },
  { id: "care", label: "Notes and care coordination", icon: NotebookPen },
  { id: "history", label: "History", icon: History },
] as const;
export function ProfessionalCaseTabs({
  overview,
  conversation,
  appointments,
  care,
  history,
  activeIndex,
  onActiveChange,
}: {
  activeIndex?: number;
  onActiveChange?: (index: number) => void;
  overview: ReactNode;
  conversation: ReactNode;
  appointments: ReactNode;
  care: ReactNode;
  history: ReactNode;
}) {
  const [local, setLocal] = useState(0);
  const active = activeIndex ?? local;
  const setActive = (index: number) => {
    setLocal(index);
    onActiveChange?.(index);
  };
  const base = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const panels = { overview, conversation, appointments, care, history };
  function navigate(event: KeyboardEvent, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % sections.length;
    else if (event.key === "ArrowLeft") next = (index + sections.length - 1) % sections.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = sections.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    buttons.current[next]?.focus();
  }
  return (
    <div className="min-w-0">
      <div
        role="tablist"
        aria-label="Case workspace"
        className="mb-6 grid grid-cols-2 gap-1 rounded-2xl border border-border/70 bg-secondary/30 p-1.5 sm:flex sm:flex-wrap"
      >
        {sections.map(({ id, label, icon: Icon }, index) => (
          <button
            key={id}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="tab"
            id={base + "-" + id}
            aria-controls={base + "-panel-" + id}
            aria-selected={active === index}
            tabIndex={active === index ? 0 : -1}
            onKeyDown={(event) => navigate(event, index)}
            onClick={() => setActive(index)}
            className={
              "echo-focus-ring inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold sm:flex-1 " +
              (active === index ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:bg-card/70")
            }
          >
            <Icon size={16} className="shrink-0" aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>
      {sections.map(({ id }, index) => (
        <section
          key={id}
          role="tabpanel"
          id={base + "-panel-" + id}
          aria-labelledby={base + "-" + id}
          hidden={active !== index}
          tabIndex={0}
          className="echo-focus-ring min-w-0 space-y-6 rounded-2xl"
        >
          {panels[id]}
        </section>
      ))}
    </div>
  );
}

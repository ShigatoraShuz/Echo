"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Leaf,
  PenLine,
  Sparkles,
  X,
} from "lucide-react";

import { DefaultJournalFilters, type JournalEntry } from "../model/journal.model";
import { getJournalService } from "@/services/journal/journal-service.factory";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const FULL_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCalendarDays(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const firstVisibleDay = new Date(firstDay);
  firstVisibleDay.setDate(firstVisibleDay.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstVisibleDay);
    day.setDate(firstVisibleDay.getDate() + index);
    return day;
  });
}

function isSameDay(left: Date, right: Date) {
  return toLocalDateKey(left) === toLocalDateKey(right);
}

type ReflectionCalendarModalProps = {
  collapsed: boolean;
};

export function ReflectionCalendarModal({ collapsed }: ReflectionCalendarModalProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [hasMounted, setHasMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => setHasMounted(true), []);

  const close = useCallback(() => {
    setIsOpen(false);
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    } else {
      triggerRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [close, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();
    getJournalService()
      .listEntries(DefaultJournalFilters, 1, 100, controller.signal)
      .then((result) => {
        if (result.success) setEntries(result.data.entries);
      });

    return () => controller.abort();
  }, [isOpen]);

  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const entriesByDate = useMemo(() => {
    const grouped = new Map<string, JournalEntry[]>();
    entries.forEach((entry) => {
      const dayEntries = grouped.get(entry.createdAt) ?? [];
      dayEntries.push(entry);
      grouped.set(entry.createdAt, dayEntries);
    });
    return grouped;
  }, [entries]);
  const selectedEntries = entriesByDate.get(toLocalDateKey(selectedDate)) ?? [];

  const chooseDate = (date: Date) => {
    setSelectedDate(startOfDay(date));
    if (date.getMonth() !== visibleMonth.getMonth() || date.getFullYear() !== visibleMonth.getFullYear()) {
      setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  const showPreviousMonth = () => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };

  const showNextMonth = () => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };

  const returnToToday = () => {
    setSelectedDate(today);
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const modal = isOpen ? (
    <div
      className="echo-reflection-calendar__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reflection-calendar-title"
        aria-describedby="reflection-calendar-description"
        tabIndex={-1}
        className="echo-reflection-calendar__dialog"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#bad7b4]/30 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 -left-12 h-52 w-52 rounded-full bg-[#f1d7b7]/30 blur-3xl" aria-hidden="true" />

        <header className="relative flex items-start justify-between gap-4 border-b border-[#173725]/10 px-5 py-5 sm:px-7">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#173725] text-[#fffdf7] shadow-[0_10px_24px_rgba(23,55,37,0.18)]">
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#557144]">Your quiet rhythm</p>
              <h2 id="reflection-calendar-title" className="mt-0.5 font-[family-name:var(--font-echo-display)] text-2xl font-medium tracking-[-0.035em] text-[#173725] sm:text-3xl">
                Reflection calendar
              </h2>
              <p id="reflection-calendar-description" className="mt-1 text-sm text-[#4f5d50]">
                Notice the days you made a little room for yourself.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#173725]/10 bg-white/70 text-[#385545] outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-white focus-visible:ring-4 focus-visible:ring-[#557144]/20 active:scale-[0.97]"
            aria-label="Close reflection calendar"
          >
            <X className="h-4.5 w-4.5" aria-hidden="true" />
          </button>
        </header>

        <div className="relative grid min-h-0 gap-5 overflow-y-auto p-5 sm:p-7 lg:grid-cols-[minmax(0,1.45fr)_minmax(240px,0.7fr)]">
          <section aria-label="Monthly calendar">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-bold tracking-[-0.025em] text-[#173725]" aria-live="polite">
                {MONTH_FORMATTER.format(visibleMonth)}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={returnToToday}
                  className="h-9 rounded-full border border-[#557144]/20 bg-white/65 px-4 text-xs font-bold text-[#385545] outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-white focus-visible:ring-4 focus-visible:ring-[#557144]/20 active:scale-[0.97]"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={showPreviousMonth}
                  className="grid h-9 w-9 place-items-center rounded-full border border-[#557144]/20 bg-white/65 text-[#385545] outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-white focus-visible:ring-4 focus-visible:ring-[#557144]/20 active:scale-[0.97]"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={showNextMonth}
                  className="grid h-9 w-9 place-items-center rounded-full border border-[#557144]/20 bg-white/65 text-[#385545] outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-white focus-visible:ring-4 focus-visible:ring-[#557144]/20 active:scale-[0.97]"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center sm:gap-2">
              {WEEKDAYS.map((weekday) => (
                <div key={weekday} className="pb-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#6d7b6e]">
                  {weekday}
                </div>
              ))}
              {calendarDays.map((date) => {
                const dateKey = toLocalDateKey(date);
                const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
                const isSelected = isSameDay(date, selectedDate);
                const isToday = isSameDay(date, today);
                const hasReflection = entriesByDate.has(dateKey);

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => chooseDate(date)}
                    className={`group relative aspect-square min-h-10 rounded-2xl border text-sm font-semibold outline-none transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-out focus-visible:ring-4 focus-visible:ring-[#557144]/20 active:scale-[0.96] ${
                      isSelected
                        ? "border-[#173725] bg-[#173725] text-[#fffdf7] shadow-[0_8px_18px_rgba(23,55,37,0.18)]"
                        : isToday
                          ? "border-[#557144]/45 bg-[#eef4e9] text-[#173725] hover:bg-[#e3eddc]"
                          : "border-transparent bg-white/45 text-[#385545] hover:-translate-y-0.5 hover:border-[#557144]/20 hover:bg-white/85"
                    } ${isCurrentMonth ? "" : "opacity-35"}`}
                    aria-label={`${FULL_DATE_FORMATTER.format(date)}${hasReflection ? ", has reflection" : ""}`}
                    aria-pressed={isSelected}
                  >
                    <span>{date.getDate()}</span>
                    {hasReflection ? (
                      <span
                        className={`absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${isSelected ? "bg-[#bfe0ae]" : "bg-[#557144]"}`}
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#173725]/10 pt-4 text-xs text-[#69766a]">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#557144]" aria-hidden="true" />
                Reflection saved
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 rounded-md border border-[#557144]/45 bg-[#eef4e9]" aria-hidden="true" />
                Today
              </span>
            </div>
          </section>

          <aside className="flex min-h-[300px] flex-col rounded-[1.6rem] border border-[#173725]/10 bg-[linear-gradient(160deg,rgba(255,253,247,0.9),rgba(225,237,220,0.78))] p-5 shadow-[0_16px_36px_rgba(23,55,37,0.08)]">
            <div className="flex items-center gap-2 text-[#557144]">
              <Leaf className="h-4 w-4" aria-hidden="true" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.16em]">Selected day</span>
            </div>
            <p className="mt-3 font-[family-name:var(--font-echo-display)] text-2xl leading-tight tracking-[-0.03em] text-[#173725]">
              {FULL_DATE_FORMATTER.format(selectedDate)}
            </p>

            <div className="mt-5 flex-1 rounded-2xl border border-[#173725]/8 bg-white/55 p-4">
              {selectedEntries.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 text-[#385545]">
                    <BookOpen className="h-4 w-4" aria-hidden="true" />
                    <p className="text-xs font-bold">{selectedEntries.length === 1 ? "A reflection lives here" : `${selectedEntries.length} reflections live here`}</p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {selectedEntries.slice(0, 2).map((entry) => (
                      <Link
                        key={entry.id}
                        href={`/journal/${entry.id}`}
                        onClick={close}
                        className="group flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2.5 text-sm font-semibold text-[#173725] outline-none transition-[background-color,transform] duration-150 ease-out hover:translate-x-0.5 hover:bg-white focus-visible:ring-4 focus-visible:ring-[#557144]/20"
                      >
                        <span className="truncate">{entry.title}</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 text-[#557144]" aria-hidden="true" />
                  <p className="mt-3 text-sm font-bold text-[#173725]">An open page</p>
                  <p className="mt-1 text-sm leading-6 text-[#647165]">
                    You do not need a perfect thought. Begin with whatever feels present.
                  </p>
                </>
              )}
            </div>

            <div className="mt-4 grid gap-2">
              <Link
                href="/journal/new"
                onClick={close}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#173725] px-5 text-sm font-bold text-[#fffdf7] outline-none transition-[background-color,transform,box-shadow] duration-150 ease-out hover:bg-[#284d34] hover:shadow-[0_10px_22px_rgba(23,55,37,0.18)] focus-visible:ring-4 focus-visible:ring-[#557144]/25 active:scale-[0.97]"
              >
                <PenLine className="h-4 w-4" aria-hidden="true" />
                Write a reflection
              </Link>
              <Link
                href="/journal"
                onClick={close}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#557144]/25 bg-white/55 px-5 text-sm font-bold text-[#385545] outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-white focus-visible:ring-4 focus-visible:ring-[#557144]/20 active:scale-[0.97]"
              >
                Open journal
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className="echo-app-sidebar__nav-link group relative flex h-11 items-center rounded-xl text-[var(--landing-inverse-80)] outline-none hover:translate-x-0.5 hover:bg-white/10 hover:text-[var(--landing-inverse)] focus-visible:ring-4 focus-visible:ring-ring/20"
        title={collapsed ? "Calendar" : undefined}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <CalendarDays className="h-[19px] w-[19px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
        <span className="echo-app-sidebar__nav-label whitespace-nowrap text-sm font-medium">
          Calendar
        </span>
      </button>
      {hasMounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}

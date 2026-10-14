"use client";

import Link from "next/link";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Plus, Stethoscope, Trash2 } from "lucide-react";
import { toLocalDateKey } from "../model/calendar-date";
import { useCalendarViewModel } from "../view-model/use-calendar-view-model";

const dateLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarView() {
  const {
    month, days, selected, selectedEntries, selectedItems, selectedAppointments,
    entryCounts, itemCounts, appointmentCounts, analyses,
    loading, saving, error, content, time, kind, setSelected, setContent, setTime, setKind,
    goToday, shiftMonth, addItem, toggleItem, removeItem, retry,
  } = useCalendarViewModel();

  return (
    <main className="flex min-w-0 flex-col gap-3 [font-family:var(--font-echo-sans)] lg:h-full lg:min-h-0">
      <header className="echo-workspace-enter shrink-0 rounded-[1.5rem] border border-[var(--landing-primary-15)] bg-[var(--landing-cream)] p-4 shadow-sm">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[var(--landing-primary)]">
          <CalendarDays size={16} /> Your reflection calendar
        </p>
        <h1 className="mt-1 text-[1.9rem] leading-tight text-[var(--landing-ink)] [font-family:var(--font-echo-display)]">
          A place for each day
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--landing-muted)]">
          Revisit reflections, professional appointments, and the reminders you choose to keep.
        </p>
      </header>
      {error && (
        <p role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-crisis-soft p-3 text-sm text-danger">
          <span>{error}</span>
          <button type="button" onClick={retry} className="shrink-0 font-semibold underline">Retry</button>
        </p>
      )}
      <div className="grid min-w-0 gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,64fr)_minmax(300px,36fr)]">
        <section
          aria-label="Monthly calendar"
          className="echo-workspace-enter flex min-w-0 flex-col rounded-[1.5rem] border border-[var(--landing-primary-15)] bg-white/90 p-3 shadow-sm sm:p-4 lg:min-h-0"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[1.45rem] text-[var(--landing-ink)] [font-family:var(--font-echo-display)]">
              {monthLabel.format(month)}
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goToday}
                className="rounded-full px-3 py-2 text-xs font-semibold text-[var(--landing-primary)] hover:bg-[var(--landing-sage-soft)]"
              >
                Today
              </button>
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
                className="rounded-full p-2 hover:bg-[var(--landing-sage-soft)]"
              >
                <ChevronLeft size={19} />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
                className="rounded-full p-2 hover:bg-[var(--landing-sage-soft)]"
              >
                <ChevronRight size={19} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[var(--landing-muted)]">
            {weekdays.map((day) => (
              <span key={day} className="py-2">
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 lg:min-h-0 lg:flex-1 lg:auto-rows-fr" aria-busy={loading}>
            {days.map((day) => {
              const key = toLocalDateKey(day);
              const count = entryCounts.get(key) ?? 0;
              const plans = itemCounts.get(key) ?? 0;
              const appointments = appointmentCounts.get(key) ?? 0;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(key)}
                  aria-label={`${dateLabel.format(day)}: ${count} reflections, ${plans} calendar items, ${appointments} appointments`}
                  aria-pressed={selected === key}
                  className={`echo-workspace-tile aspect-square min-w-0 rounded-xl border p-1.5 text-left text-xs outline-none focus-visible:ring-4 focus-visible:ring-ring/20 sm:text-sm lg:aspect-auto lg:min-h-0 ${selected === key ? "border-[var(--landing-primary)] bg-[var(--landing-sage-soft)] text-[var(--landing-primary)]" : "border-[var(--landing-primary-10)] bg-[var(--landing-surface)] hover:border-[var(--landing-primary)]"} ${day.getMonth() !== month.getMonth() ? "opacity-45" : ""}`}
                >
                  <span className="font-semibold">{day.getDate()}</span>
                  <span className="mt-1 flex gap-1">
                    {count > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[var(--landing-primary)]" />}
                    {plans > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                    {appointments > 0 && <span className="h-1.5 w-1.5 rounded-full bg-sky-600" />}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[var(--landing-muted)]">
            Green: reflections · Gold: reminders or notes · Blue: professional appointments
          </p>
        </section>
        <aside key={selected} className="echo-reading-swap echo-panel-scroll min-w-0 space-y-3 lg:min-h-0 lg:overflow-y-auto" tabIndex={0} aria-label="Selected day details">
          <section className="rounded-[1.5rem] border border-[var(--landing-primary-15)] bg-white/90 p-4 shadow-sm">
            <h2 className="text-xl text-[var(--landing-ink)] [font-family:var(--font-echo-display)]">
              {dateLabel.format(new Date(`${selected}T12:00:00`))}
            </h2>
            <p className="mt-1 text-xs text-[var(--landing-muted)]">
              {loading
                ? "Loading the day…"
                : `${selectedEntries.length} reflections · ${selectedItems.length} saved items · ${selectedAppointments.length} ${selectedAppointments.length === 1 ? "appointment" : "appointments"}`}
            </p>
            <div className="mt-3 space-y-2">
              {selectedEntries.map((entry) => {
                const analysis = analyses[entry.id];
                return (
                  <article
                    key={entry.id}
                    className="rounded-2xl border border-[var(--landing-primary-15)] bg-[var(--landing-cream)] p-4"
                  >
                    <Link
                      href={`/journal/${encodeURIComponent(entry.id)}`}
                      className="font-semibold text-[var(--landing-ink)] underline-offset-4 hover:underline"
                    >
                      {entry.title}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--landing-muted)]">
                      {entry.excerpt || entry.body}
                    </p>
                    <span className="mt-2 inline-block rounded-full bg-[var(--landing-sage-soft)] px-2 py-1 text-[10px] font-semibold capitalize text-[var(--landing-primary)]">
                      {entry.mood}
                    </span>
                    {analysis && (
                      <div className="mt-3 border-t border-[var(--landing-primary-15)] pt-3 text-xs leading-5 text-[var(--landing-muted)]">
                        <p className="font-semibold text-[var(--landing-primary)]">Completed analysis</p>
                        <p>{analysis.summary}</p>
                        {analysis.result?.recommendationFeatures?.length ? (
                          <p className="mt-1">
                            Suggested next steps:{" "}
                            {analysis.result.recommendationFeatures
                              .map((feature) => feature.replaceAll("_", " "))
                              .join(", ")}
                          </p>
                        ) : null}
                      </div>
                    )}
                    {entry.analysisConsent && !analysis && (
                      <p className="mt-3 border-t border-[var(--landing-primary-15)] pt-3 text-xs text-[var(--landing-muted)]">
                        {analyses[entry.id] === undefined
                          ? "Checking for completed analysis…"
                          : analyses[entry.id] === false
                            ? "Analysis could not be loaded. Open the reflection to try again."
                            : "No completed analysis is available for this reflection."}
                      </p>
                    )}
                  </article>
                );
              })}
              {!loading && selectedEntries.length === 0 && (
                <p className="text-sm text-[var(--landing-muted)]">No reflections saved for this day.</p>
              )}
            </div>
          </section>
          <section className="rounded-[1.5rem] border border-[var(--landing-primary-15)] bg-white/90 p-4 shadow-sm" aria-labelledby="calendar-appointments-heading">
            <div className="flex items-center justify-between gap-3">
              <h2 id="calendar-appointments-heading" className="text-xl text-[var(--landing-ink)] [font-family:var(--font-echo-display)]">
                Professional appointments
              </h2>
              <Stethoscope size={18} className="text-sky-700" aria-hidden="true" />
            </div>
            {selectedAppointments.length ? (
              <ul className="mt-4 space-y-2">
                {selectedAppointments.map((appointment) => (
                  <li key={appointment.id} className="rounded-2xl border border-sky-100 bg-sky-50/60 p-3">
                    <p className="text-sm font-semibold text-[var(--landing-ink)]">
                      {new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(appointment.startsAt))}
                      {" · "}{appointment.mode.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-xs capitalize text-[var(--landing-muted)]">{appointment.status}</p>
                    {appointment.locationHint ? <p className="mt-1 text-xs text-[var(--landing-muted)]">{appointment.locationHint}</p> : null}
                    <Link href="/professional-support/appointments" className="mt-2 inline-block text-xs font-semibold text-[var(--landing-primary)] underline-offset-4 hover:underline">
                      View appointment
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-sm text-[var(--landing-muted)]">No professional appointments on this day.</p>}
          </section>
          <section className="rounded-[1.5rem] border border-[var(--landing-primary-15)] bg-white/90 p-4 shadow-sm">
            <h2 className="text-xl text-[var(--landing-ink)] [font-family:var(--font-echo-display)]">
              Reminders & notes
            </h2>
            <div className="mt-4 space-y-2">
              {selectedItems.map((item) => (
                <div key={item.id} className="flex items-start gap-2 rounded-2xl bg-[var(--landing-cream)] p-3">
                  <button
                    type="button"
                    onClick={() => void toggleItem(item)}
                    aria-label={item.completedAt ? "Mark incomplete" : "Mark complete"}
                    className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[var(--landing-primary)] text-[var(--landing-primary)]"
                  >
                    {item.completedAt && <Check size={15} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`break-words text-sm text-[var(--landing-ink)] ${item.completedAt ? "line-through opacity-60" : ""}`}
                    >
                      {item.content}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs capitalize text-[var(--landing-muted)]">
                      {item.kind}
                      {item.scheduledTime && (
                        <>
                          {" "}
                          · <Clock3 size={12} />
                          {item.scheduledTime}
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeItem(item)}
                    aria-label={`Delete ${item.kind}`}
                    className="rounded-full p-1 text-[var(--landing-muted)] hover:text-red-700"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <form onSubmit={addItem} className="mt-5 space-y-3 border-t border-[var(--landing-primary-15)] pt-5">
              <label className="block text-xs font-semibold text-[var(--landing-ink)]" htmlFor="calendar-content">
                Add to this day
              </label>
              <input
                id="calendar-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                maxLength={500}
                required
                placeholder="What would you like to remember?"
                className="w-full rounded-xl border border-[var(--landing-primary-15)] bg-white p-3 text-sm outline-none focus:border-[var(--landing-primary)]"
              />
              <div className="flex flex-wrap gap-2">
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value as "reminder" | "note")}
                  aria-label="Calendar item type"
                  className="rounded-xl border border-[var(--landing-primary-15)] bg-white p-2 text-sm"
                >
                  <option value="reminder">Reminder</option>
                  <option value="note">Note</option>
                </select>
                <input
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  aria-label="Optional time"
                  className="rounded-xl border border-[var(--landing-primary-15)] bg-white p-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={saving || !content.trim()}
                  className="inline-flex items-center gap-1 rounded-xl bg-[var(--landing-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Plus size={15} />
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
              <p className="text-xs text-[var(--landing-muted)]">
                Saved to this calendar only. No timed notification is sent.
              </p>
            </form>
          </section>
        </aside>
      </div>
    </main>
  );
}

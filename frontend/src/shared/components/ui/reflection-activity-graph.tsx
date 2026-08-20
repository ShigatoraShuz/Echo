"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { cn } from "@/shared/lib/utils";

export type ReflectionActivity = {
  date: string;
  count: number;
};

type ActivityCell = ReflectionActivity & {
  level: number;
};

export interface ReflectionActivityGraphProps {
  data: ReflectionActivity[];
  weeks?: number;
  cellSize?: number;
  cellGap?: number;
  showLegend?: boolean;
  ariaLabel?: string;
  singularLabel?: string;
  pluralLabel?: string;
  className?: string;
}

// Intensity steps: 0 entries = lightest muted, 1+ entries scale up to full primary
// We use inline style with rgba so we get smooth interpolation
const LEVEL_BASE_RGBA = "rgba(83, 103, 51,"; // --landing-primary #536733
const LEVEL_MUTED_RGBA = "rgba(83, 103, 51, 0.10)"; // empty cell

function getCellStyle(level: number): React.CSSProperties {
  if (level === 0) return { backgroundColor: LEVEL_MUTED_RGBA };
  // level 1→4 maps to opacity 0.28 → 0.52 → 0.72 → 1.0
  const opacities = [0, 0.28, 0.52, 0.74, 1.0];
  return { backgroundColor: `${LEVEL_BASE_RGBA} ${opacities[level]})` };
}

function getDotColor(count: number): string {
  if (count === 0) return "rgba(83, 103, 51, 0.35)";
  if (count === 1) return "#739944";
  if (count === 2) return "#536733";
  if (count <= 4) return "#3b4f21";
  return "#1e3314";
}

const levelClasses = [
  "bg-secondary/70",
  "bg-primary/25",
  "bg-primary/45",
  "bg-primary/70",
  "bg-primary",
] as const;

const weekdayLabels = ["M", "T", "W", "T", "F", "S", "S"] as const;

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function buildReflectionActivityWeeks(
  activity: ReflectionActivity[],
  weekCount: number,
): ActivityCell[][] {
  const safeWeekCount = Math.max(4, Math.min(30, Math.round(weekCount)));
  const totals = new Map<string, number>();

  for (const item of activity) {
    if (!parseDate(item.date) || !Number.isFinite(item.count)) continue;
    totals.set(item.date, (totals.get(item.date) ?? 0) + Math.max(0, item.count));
  }

  const today = new Date();
  const end = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const mondayBasedDay = (end.getUTCDay() + 6) % 7;
  const finalSunday = addDays(end, 6 - mondayBasedDay);
  const firstMonday = addDays(finalSunday, -(safeWeekCount * 7 - 1));
  const maxCount = Math.max(1, ...totals.values());
  const cells: ActivityCell[] = [];

  for (
    let date = firstMonday;
    date <= finalSunday;
    date = addDays(date, 1)
  ) {
    const key = toISODate(date);
    const count = totals.get(key) ?? 0;
    const level =
      count === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((count / maxCount) * 4)));
    cells.push({ date: key, count, level });
  }

  return Array.from({ length: safeWeekCount }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
  );
}

function formatActivityLabel(
  cell: ActivityCell,
  singularLabel: string,
  pluralLabel: string,
): string {
  const parsed = parseDate(cell.date);
  const dateStr = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed ?? new Date());
  if (cell.count === 0) return `No ${pluralLabel} · ${dateStr}`;
  const countLabel = cell.count === 1 ? `1 ${singularLabel}` : `${cell.count} ${pluralLabel}`;
  return `${countLabel} · ${dateStr}`;
}

function getFormattedDateComponents(dateKey: string) {
  const parsed = parseDate(dateKey);
  const d = parsed ?? new Date();
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(d);
  const monthDayYear = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(d);
  return { weekday, monthDayYear };
}

// ─── Floating tooltip rendered in a document.body portal ─────────────────────
// This bypasses `overflow-hidden` and CSS 3-D transform containing blocks
// that would otherwise clip or misplace position:fixed elements.

interface TooltipPortalProps {
  hoveredCell: {
    cell: ActivityCell;
    left: number;
    top: number;
    placement: "above" | "below";
  };
  reducedMotion: boolean | null;
  singularLabel: string;
  pluralLabel: string;
}

function TooltipPortal({
  hoveredCell,
  reducedMotion,
  singularLabel,
  pluralLabel,
}: TooltipPortalProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const { weekday, monthDayYear } = getFormattedDateComponents(hoveredCell.cell.date);
  const count = hoveredCell.cell.count;
  const level = hoveredCell.cell.level;
  const countText =
    count === 0
      ? `No ${pluralLabel} recorded`
      : count === 1
      ? `1 ${singularLabel} entry`
      : `${count} ${singularLabel} entries`;
  const dotColor = getDotColor(count);

  const yOffset = hoveredCell.placement === "above" ? "-100%" : "0%";
  const yInitial = hoveredCell.placement === "above" ? "-94%" : "6%";

  return ReactDOM.createPortal(
    <AnimatePresence>
      <motion.div
        role="tooltip"
        className="pointer-events-none fixed flex flex-col items-center gap-1.5 whitespace-nowrap rounded-2xl border border-[rgba(83,103,51,0.25)] bg-[rgba(255,253,247,0.98)] px-4 py-3 text-center shadow-[0_16px_40px_rgba(20,40,15,0.18)] backdrop-blur-md"
        style={{
          left: hoveredCell.left,
          top: hoveredCell.top,
          x: "-50%",
          y: yOffset,
          transformOrigin:
            hoveredCell.placement === "above" ? "center bottom" : "center top",
          zIndex: 99999,
        }}
        initial={{ opacity: 0, scale: 0.88, y: yInitial }}
        animate={{ opacity: 1, scale: 1, y: yOffset }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: reducedMotion ? 0 : 0.13, ease: "easeOut" }}
      >
        {/* Day name — prominent dark green */}
        <span className="text-sm font-black tracking-tight text-[#1e3314] leading-tight">
          {weekday}
        </span>

        {/* Full date — dark green muted subtitle */}
        <span className="text-[11px] font-bold text-[#536733] leading-none">
          {monthDayYear}
        </span>

        {/* Divider */}
        <div className="my-0.5 h-px w-full bg-[rgba(83,103,51,0.2)]" aria-hidden="true" />

        {/* Entry count with dot */}
        <div className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: dotColor }}
            aria-hidden="true"
          />
          <span className="text-xs font-extrabold text-[#1e3314]">
            {countText}
          </span>
        </div>

        {/* Intensity dots — 5 segments light → dark green */}
        <div className="mt-0.5 flex items-center gap-[3px]" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((seg) => (
            <span
              key={seg}
              className="h-1.5 w-4 rounded-full transition-colors"
              style={{
                backgroundColor:
                  seg <= level
                    ? "#3d5424"
                    : "rgba(83, 103, 51, 0.16)",
              }}
            />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReflectionActivityGraph({
  data,
  weeks = 12,
  cellSize = 14,
  cellGap = 4,
  showLegend = true,
  ariaLabel = "Recent reflection activity, Monday through Sunday",
  singularLabel = "reflection",
  pluralLabel = "reflections",
  className,
}: ReflectionActivityGraphProps) {
  const reducedMotion = useReducedMotion();
  const activityWeeks = React.useMemo(
    () => buildReflectionActivityWeeks(data, weeks),
    [data, weeks],
  );
  const graphWidth =
    activityWeeks.length * cellSize +
    Math.max(0, activityWeeks.length - 1) * cellGap;
  const monthMarkers = React.useMemo(
    () =>
      activityWeeks.flatMap((week, weekIndex) => {
        const monthStart = week.find((cell) => cell.date.endsWith("-01"));
        const representative = monthStart ?? (weekIndex === 0 ? week[0] : null);
        if (!representative) return [];

        const parsed = parseDate(representative.date);
        if (!parsed) return [];

        return [
          {
            label: new Intl.DateTimeFormat("en", { month: "short" }).format(
              parsed,
            ),
            weekIndex,
          },
        ];
      }),
    [activityWeeks],
  );
  const [hoveredCell, setHoveredCell] = React.useState<{
    cell: ActivityCell;
    left: number;
    top: number;
    placement: "above" | "below";
  } | null>(null);

  const showTooltip = React.useCallback(
    (element: HTMLButtonElement, cell: ActivityCell) => {
      const rect = element.getBoundingClientRect();
      const placement = rect.top > 64 ? "above" : "below";

      setHoveredCell({
        cell,
        left: Math.min(
          Math.max(rect.left + rect.width / 2, 92),
          window.innerWidth - 92,
        ),
        top: placement === "above" ? rect.top - 8 : rect.bottom + 8,
        placement,
      });
    },
    [],
  );

  return (
    <div className={cn("max-w-full", className)}>
      <div className="overflow-x-auto py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="min-w-max">
          <div
            className="relative mb-1.5 h-4 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            style={{ width: graphWidth, marginLeft: 20 }}
            aria-hidden="true"
          >
            {monthMarkers.map((marker) => (
              <span
                key={`${marker.label}-${marker.weekIndex}`}
                className="absolute top-0"
                style={{ left: marker.weekIndex * (cellSize + cellGap) }}
              >
                {marker.label}
              </span>
            ))}
          </div>

          <div className="flex items-start gap-2">
            <div
              className="grid w-3 shrink-0 grid-rows-7 text-[9px] font-medium text-muted-foreground"
              style={{ gap: cellGap }}
              aria-hidden="true"
            >
              {weekdayLabels.map((label, index) => (
                <span
                  key={`${label}-${index}`}
                  className="grid place-items-center"
                  style={{ height: cellSize }}
                >
                  {label}
                </span>
              ))}
            </div>

            <div
              className="flex min-w-max"
              style={{ gap: cellGap }}
              role="grid"
              aria-label={ariaLabel}
              onMouseLeave={() => setHoveredCell(null)}
            >
              {activityWeeks.map((week, weekIndex) => (
                <div
                  key={week[0]?.date ?? weekIndex}
                  className="grid grid-rows-7"
                  style={{ gap: cellGap }}
                  role="row"
                >
                  {week.map((cell, dayIndex) => {
                    const entranceDelay = reducedMotion
                      ? 0
                      : weekIndex * 0.025 + dayIndex * 0.014;
                    const ambientDelay =
                      entranceDelay + ((weekIndex * 7 + dayIndex) % 9) * 0.12;

                    return (
                      <motion.button
                        key={cell.date}
                        type="button"
                        role="gridcell"
                        aria-label={formatActivityLabel(
                          cell,
                          singularLabel,
                          pluralLabel,
                        )}
                        className={cn(
                          "relative cursor-pointer rounded-[4px] outline-none ring-offset-2 ring-offset-card transition-[filter,box-shadow,transform] duration-150 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary/55",
                        )}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          ...getCellStyle(cell.level),
                        }}
                        initial={
                          reducedMotion
                            ? false
                            : { opacity: 0, scale: 0.88, y: 3 }
                        }
                        animate={
                          reducedMotion
                            ? { opacity: 1, scale: 1, y: 0 }
                            : {
                                opacity: [
                                  1,
                                  cell.level === 0 ? 0.82 : 0.9,
                                  1,
                                ],
                                scale: [
                                  1,
                                  cell.level === 0 ? 0.96 : 0.94,
                                  1,
                                ],
                                y: 0,
                              }
                        }
                        transition={
                          reducedMotion
                            ? { duration: 0 }
                            : {
                                opacity: {
                                  duration: 3.1,
                                  delay: ambientDelay,
                                  ease: "easeInOut",
                                  repeat: Infinity,
                                },
                                scale: {
                                  duration: 3.1,
                                  delay: ambientDelay,
                                  ease: "easeInOut",
                                  repeat: Infinity,
                                },
                                y: {
                                  type: "spring",
                                  stiffness: 520,
                                  damping: 28,
                                  delay: entranceDelay,
                                },
                              }
                        }
                        whileHover={reducedMotion ? undefined : { scale: 1.22, zIndex: 10 }}
                        whileTap={reducedMotion ? undefined : { scale: 0.94 }}
                        onMouseEnter={(event) =>
                          showTooltip(event.currentTarget, cell)
                        }
                        onFocus={(event) =>
                          showTooltip(event.currentTarget, cell)
                        }
                        onBlur={() => setHoveredCell(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showLegend ? (
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
          <span className="mr-1">Quiet</span>
          {levelClasses.map((levelClass) => (
            <span
              key={levelClass}
              className={cn("h-3 w-3 rounded-[3px]", levelClass)}
              aria-hidden="true"
            />
          ))}
          <span className="ml-1">Reflective</span>
        </div>
      ) : null}

      {/* Portal tooltip — rendered on document.body to escape overflow/transform clipping */}
      {hoveredCell && (
        <TooltipPortal
          hoveredCell={hoveredCell}
          reducedMotion={reducedMotion}
          singularLabel={singularLabel}
          pluralLabel={pluralLabel}
        />
      )}
    </div>
  );
}

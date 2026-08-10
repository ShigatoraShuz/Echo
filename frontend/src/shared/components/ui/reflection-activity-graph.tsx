"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

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
  const date = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(parsed ?? new Date());
  const activityLabel = cell.count === 1 ? singularLabel : pluralLabel;
  return `${cell.count} ${activityLabel} · ${date}`;
}

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
                          "relative rounded-[4px] outline-none ring-offset-2 ring-offset-card transition-[filter,box-shadow] duration-150 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary/55",
                          levelClasses[cell.level],
                        )}
                        style={{ width: cellSize, height: cellSize }}
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
                        whileHover={reducedMotion ? undefined : { scale: 1.16 }}
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

      <AnimatePresence>
        {hoveredCell ? (
          <motion.span
            role="tooltip"
            className="pointer-events-none fixed z-[160] whitespace-nowrap rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-card"
            style={{
              left: hoveredCell.left,
              top: hoveredCell.top,
              x: "-50%",
              y: hoveredCell.placement === "above" ? "-100%" : "0%",
              transformOrigin:
                hoveredCell.placement === "above"
                  ? "center bottom"
                  : "center top",
            }}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: reducedMotion ? 0 : 0.14, ease: "easeOut" }}
          >
            {formatActivityLabel(
              hoveredCell.cell,
              singularLabel,
              pluralLabel,
            )}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

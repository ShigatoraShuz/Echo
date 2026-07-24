"use client";
import type { InsightTimeRange } from "../model/insights.model";
import { TIME_RANGE_LABELS } from "../model/insights.constants";

interface TimeRangeSelectorProps {
  value: InsightTimeRange;
  onChange: (range: InsightTimeRange) => void;
}

const ranges: InsightTimeRange[] = ["7d", "30d", "90d", "custom"];

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Time range">
      {ranges.map((range) => (
        <button
          key={range}
          type="button"
          role="radio"
          aria-checked={value === range}
          onClick={() => onChange(range)}
          className={ounded-full px-4 py-2 text-sm font-semibold transition-colors }
        >
          {TIME_RANGE_LABELS[range]}
        </button>
      ))}
    </div>
  );
}

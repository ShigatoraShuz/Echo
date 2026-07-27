"use client";
import { useState } from "react";
import { Calendar } from "lucide-react";

interface DateRangeFilterProps {
  dateFrom: string | null;
  dateTo: string | null;
  onChange: (from: string | null, to: string | null) => void;
}

export function JournalDateRange({ dateFrom, dateTo, onChange }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary/50">
        <Calendar className="h-3.5 w-3.5" />
        {dateFrom || dateTo ? "Custom" : "Date range"}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-2 w-72 rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">From</label>
              <input type="date" value={dateFrom ?? ""} onChange={(e) => onChange(e.target.value || null, dateTo)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">To</label>
              <input type="date" value={dateTo ?? ""} onChange={(e) => onChange(dateFrom, e.target.value || null)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </div>
            <button type="button" onClick={() => onChange(null, null)} className="text-xs font-medium text-primary hover:text-primary/80">Clear dates</button>
          </div>
        </div>
      )}
    </div>
  );
}

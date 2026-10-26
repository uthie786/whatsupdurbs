"use client";

import { CalendarRange, X } from "lucide-react";
import { isRangeActive, type DateRange } from "@/lib/filters";

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

export default function DateRangePicker({ value, onChange, className = "" }: DateRangePickerProps) {
  const active = isRangeActive(value);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <CalendarRange className="h-5 w-5 shrink-0" aria-hidden />
      <label className="flex items-center gap-1.5 text-xs font-black uppercase">
        From
        <input
          type="date"
          value={value.from ?? ""}
          max={value.to ?? undefined}
          onChange={(e) => onChange({ ...value, from: e.target.value || null })}
          className="brutal-input w-auto !py-1 text-sm normal-case"
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs font-black uppercase">
        To
        <input
          type="date"
          value={value.to ?? ""}
          min={value.from ?? undefined}
          onChange={(e) => onChange({ ...value, to: e.target.value || null })}
          className="brutal-input w-auto !py-1 text-sm normal-case"
        />
      </label>
      {active && (
        <button
          type="button"
          onClick={() => onChange({ from: null, to: null })}
          className="brutal-btn bg-white !px-2 !py-1 !text-xs"
          aria-label="Clear date range"
        >
          <X className="h-3.5 w-3.5" strokeWidth={3} /> Clear
        </button>
      )}
    </div>
  );
}

"use client";

import { RotateCcw } from "lucide-react";
import type { AreaFilter, CategoryFilter, DateFilter } from "@/types/event";
import { EVENT_CATEGORIES } from "@/types/event";
import { AREA_FILTERS } from "@/lib/areas";
import type { DateRange } from "@/lib/filters";
import DateRangePicker from "./DateRangePicker";

export const CATEGORY_FILTERS: CategoryFilter[] = ["All", ...EVENT_CATEGORIES];
export const DATE_FILTERS: DateFilter[] = ["All", "Today", "This Weekend", "Festive Season"];

interface FilterBarProps {
  category: CategoryFilter;
  date: DateFilter;
  area: AreaFilter;
  onCategoryChange: (v: CategoryFilter) => void;
  onDateChange: (v: DateFilter) => void;
  onAreaChange: (v: AreaFilter) => void;
  dateRange: DateRange;
  onDateRangeChange: (v: DateRange) => void;
  onReset: () => void;
}

function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="w-24 shrink-0 font-display text-sm uppercase">{label}</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label={`${label} filter`}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            className="brutal-chip"
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function FilterBar(props: FilterBarProps) {
  return (
    <div className="space-y-3 border-4 border-black bg-durbs-yellow p-4 shadow-brutal-lg">
      <ChipRow
        label="Category"
        options={CATEGORY_FILTERS}
        value={props.category}
        onChange={props.onCategoryChange}
      />
      <ChipRow label="When" options={DATE_FILTERS} value={props.date} onChange={props.onDateChange} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <span className="w-24 shrink-0 font-display text-sm uppercase">Dates</span>
        <DateRangePicker value={props.dateRange} onChange={props.onDateRangeChange} />
      </div>
      <ChipRow label="Area" options={AREA_FILTERS} value={props.area} onChange={props.onAreaChange} />
      <div className="flex justify-end">
        <button type="button" onClick={props.onReset} className="brutal-btn bg-white !py-1 !text-xs">
          <RotateCcw className="h-3.5 w-3.5" /> Reset filters
        </button>
      </div>
    </div>
  );
}

"use client";

import { Heart, RotateCcw } from "lucide-react";
import type { AreaFilter, CategoryFilter, DateFilter } from "@/types/event";
import { EVENT_CATEGORIES } from "@/types/event";
import { AREA_FILTERS, categoryLabel } from "@/lib/areas";
import type { DateRange } from "@/lib/filters";
import DateRangePicker from "./DateRangePicker";
import NearMeButton from "./NearMeButton";
import type { NearMeStatus } from "@/lib/useNearMe";

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
  savedOnly: boolean;
  savedCount: number;
  onSavedOnlyChange: (v: boolean) => void;
  nearMeStatus: NearMeStatus;
  onNearMeToggle: () => void;
  onReset: () => void;
}

function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
  renderOption = (o) => o,
  scrollOnMobile = false,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  renderOption?: (o: T) => string;
  /** Long rows scroll sideways on small screens instead of wrapping into many lines. */
  scrollOnMobile?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
      <span className="w-24 shrink-0 font-display text-sm uppercase">{label}</span>
      <div
        className={`flex gap-2 ${
          scrollOnMobile ? "-mx-1 overflow-x-auto px-1 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0" : "flex-wrap"
        }`}
        role="group"
        aria-label={`${label} filter`}
      >
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            className="brutal-chip shrink-0 whitespace-nowrap"
          >
            {renderOption(o)}
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
        renderOption={(c) => (c === "All" ? "All" : categoryLabel(c))}
        scrollOnMobile
      />
      <ChipRow label="When" options={DATE_FILTERS} value={props.date} onChange={props.onDateChange} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <span className="w-24 shrink-0 font-display text-sm uppercase">Dates</span>
        <DateRangePicker value={props.dateRange} onChange={props.onDateRangeChange} />
      </div>
      <ChipRow label="Area" options={AREA_FILTERS} value={props.area} onChange={props.onAreaChange} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={props.savedOnly}
            onClick={() => props.onSavedOnlyChange(!props.savedOnly)}
            className={`brutal-btn !py-1.5 !text-xs ${props.savedOnly ? "bg-durbs-pink text-white" : "bg-white"}`}
          >
            <Heart className={`h-4 w-4 ${props.savedOnly ? "fill-white" : ""}`} /> Saved ({props.savedCount})
          </button>
          <NearMeButton status={props.nearMeStatus} onToggle={props.onNearMeToggle} />
        </div>
        <button type="button" onClick={props.onReset} className="brutal-btn bg-white !py-1 !text-xs">
          <RotateCcw className="h-3.5 w-3.5" /> Reset filters
        </button>
      </div>
    </div>
  );
}

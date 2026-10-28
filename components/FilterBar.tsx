"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Heart, RotateCcw, SlidersHorizontal } from "lucide-react";
import type { AreaFilter, DateFilter, EventCategory } from "@/types/event";
import { EVENT_CATEGORIES } from "@/types/event";
import { AREA_FILTERS, categoryLabel } from "@/lib/areas";
import { isRangeActive, type DateRange } from "@/lib/filters";
import DateRangePicker from "./DateRangePicker";
import NearMeButton from "./NearMeButton";
import type { NearMeStatus } from "@/lib/useNearMe";

const CATEGORY_OPTIONS = ["All", ...EVENT_CATEGORIES] as const;
export const DATE_FILTERS: DateFilter[] = ["All", "Today", "This Weekend", "Festive Season"];

interface FilterBarProps {
  /** Selected categories (several allowed); empty means all. */
  categories: ReadonlySet<EventCategory>;
  onToggleCategory: (c: EventCategory) => void;
  onClearCategories: () => void;
  date: DateFilter;
  area: AreaFilter;
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

const LABEL = "shrink-0 font-display text-xs uppercase sm:w-24 sm:text-sm";

function ChipRow<T extends string>({
  label,
  options,
  value,
  isPressed = (o) => o === value,
  onChange,
  renderOption = (o) => o,
  className = "",
}: {
  label: string;
  options: readonly T[];
  value?: T;
  /** For multi-select rows; defaults to `o === value`. */
  isPressed?: (o: T) => boolean;
  onChange: (v: T) => void;
  renderOption?: (o: T) => string;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 ${className}`}>
      <span className={LABEL}>{label}</span>
      {/* One sideways-scrolling row on phones; wraps from sm up. */}
      <div
        className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1.5 pt-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:p-0"
        role="group"
        aria-label={`${label} filter`}
      >
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={isPressed(o)}
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
  const [moreOpen, setMoreOpen] = useState(false);
  const datesSet = isRangeActive(props.dateRange);
  const smallBtn = "brutal-btn !gap-1.5 !px-2 !py-1.5 !text-[11px] sm:!px-4 sm:!text-xs";

  return (
    <div className="space-y-3 border-4 border-black bg-durbs-yellow p-3 shadow-brutal-lg sm:p-4">
      <ChipRow
        label="Category"
        options={CATEGORY_OPTIONS}
        isPressed={(c) => (c === "All" ? props.categories.size === 0 : props.categories.has(c))}
        onChange={(c) => (c === "All" ? props.onClearCategories() : props.onToggleCategory(c))}
        renderOption={(c) => (c === "All" ? "All" : categoryLabel(c))}
      />
      <ChipRow label="When" options={DATE_FILTERS} value={props.date} onChange={props.onDateChange} />

      {/* Desktop: dates and area always visible. */}
      <div className="hidden sm:flex sm:items-center sm:gap-2">
        <span className={LABEL}>Dates</span>
        <DateRangePicker value={props.dateRange} onChange={props.onDateRangeChange} />
      </div>
      {/* Phones use the Area dropdown in the header instead. */}
      <ChipRow
        label="Area"
        options={AREA_FILTERS}
        value={props.area}
        onChange={props.onAreaChange}
        className="!hidden sm:!flex"
      />

      {/* Phones: dates and reset tucked behind "More". */}
      {moreOpen && (
        <div className="space-y-3 border-t-3 border-black pt-3 sm:hidden">
          <DateRangePicker value={props.dateRange} onChange={props.onDateRangeChange} stacked />
          <button type="button" onClick={props.onReset} className={`${smallBtn} w-full bg-white`}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset all filters
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="contents sm:flex sm:flex-wrap sm:gap-2">
          <button
            type="button"
            aria-pressed={props.savedOnly}
            onClick={() => props.onSavedOnlyChange(!props.savedOnly)}
            className={`${smallBtn} relative whitespace-nowrap ${props.savedOnly ? "bg-durbs-pink text-white" : "bg-white"}`}
          >
            <Heart className={`h-4 w-4 shrink-0 ${props.savedOnly ? "fill-white" : ""}`} /> Saved
            <span className="hidden sm:inline">({props.savedCount})</span>
            {props.savedCount > 0 && (
              <span className="absolute -right-2 -top-2 grid h-5 min-w-[20px] place-items-center border-2 border-black bg-durbs-pink px-1 text-[10px] text-white sm:hidden">
                {props.savedCount}
              </span>
            )}
          </button>
          <NearMeButton
            status={props.nearMeStatus}
            onToggle={props.onNearMeToggle}
            className={smallBtn}
          />
        </div>
        <button
          type="button"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((o) => !o)}
          className={`${smallBtn} relative sm:hidden ${moreOpen ? "bg-black text-durbs-yellow" : "bg-white"}`}
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" /> More
          {moreOpen ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
          {datesSet && (
            <span className="absolute -right-1.5 -top-1.5 h-3 w-3 border-2 border-black bg-durbs-pink" aria-label="Dates set" />
          )}
        </button>
        <button type="button" onClick={props.onReset} className="brutal-btn hidden bg-white !py-1 !text-xs sm:inline-flex">
          <RotateCcw className="h-3.5 w-3.5" /> Reset filters
        </button>
      </div>
    </div>
  );
}

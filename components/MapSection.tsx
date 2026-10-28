"use client";

import { X } from "lucide-react";
import type { DurbsEvent, EventCategory } from "@/types/event";
import { CATEGORY_BG, CATEGORY_COLORS } from "@/lib/areas";
import { EVENT_CATEGORIES } from "@/types/event";
import type { DateRange } from "@/lib/filters";
import DateRangePicker from "./DateRangePicker";
import EventMap from "./EventMap";
import NearMeButton from "./NearMeButton";
import type { LatLng } from "@/lib/geo";
import type { NearMeStatus } from "@/lib/useNearMe";

interface MapSectionProps {
  events: DurbsEvent[];
  /** Events matching every filter except category: one tag per category present. */
  legendEvents: DurbsEvent[];
  categories: ReadonlySet<EventCategory>;
  onToggleCategory: (c: EventCategory) => void;
  onClearCategories: () => void;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  nearMeStatus?: NearMeStatus;
  onNearMeToggle?: () => void;
  nearMeError?: string | null;
  userLocation?: LatLng | null;
}

export default function MapSection({
  events,
  legendEvents,
  categories,
  onToggleCategory,
  onClearCategories,
  dateRange,
  onDateRangeChange,
  nearMeStatus,
  onNearMeToggle,
  nearMeError,
  userLocation,
}: MapSectionProps) {
  const counts = new Map<EventCategory, number>();
  for (const e of legendEvents) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  const shown = EVENT_CATEGORIES.filter((c) => counts.has(c) || categories.has(c));

  return (
    <section id="map" className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-3xl uppercase sm:text-4xl">
          <span className="bg-durbs-cyan px-2">Map</span> the vibe
        </h2>
      </div>
      {/* Category tags: tap to show only those categories (several at once); one row that scrolls on phones. */}
      <div
        className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-2 pt-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        role="group"
        aria-label="Show categories on the map"
      >
        {/* First, so it stays in view while the row scrolls on phones. */}
        {categories.size > 0 && (
          <button
            type="button"
            onClick={onClearCategories}
            className="brutal-badge shrink-0 whitespace-nowrap bg-black !py-1 text-durbs-yellow"
          >
            <X className="h-3 w-3" strokeWidth={3} /> Show all
          </button>
        )}
        {shown.map((c) => {
          const on = categories.has(c);
          const dimmed = categories.size > 0 && !on;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() => onToggleCategory(c)}
              className={`brutal-badge shrink-0 whitespace-nowrap !py-1 transition-all duration-100 ${
                on ? `${CATEGORY_BG[c]} shadow-[3px_3px_0_0_#000]` : "bg-white hover:-translate-y-0.5"
              } ${dimmed ? "opacity-50 hover:opacity-100" : ""}`}
            >
              <span
                className="inline-block h-3 w-3 border-2 border-black"
                style={{ backgroundColor: on ? "#fff" : CATEGORY_COLORS[c] }}
              />
              {c}
              <span className="font-bold opacity-70">{counts.get(c) ?? 0}</span>
            </button>
          );
        })}
      </div>
      {dateRange && onDateRangeChange && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-3 border-black bg-durbs-yellow px-3 py-2 shadow-brutal">
          <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
          <div className="flex items-center gap-2">
            {nearMeStatus && onNearMeToggle && <NearMeButton status={nearMeStatus} onToggle={onNearMeToggle} />}
            <span className="brutal-badge bg-white">
              {events.length} event{events.length === 1 ? "" : "s"} on the map
            </span>
          </div>
        </div>
      )}
      {nearMeError && (
        <p role="status" className="mb-4 border-3 border-black bg-red-500 px-3 py-2 text-sm font-bold text-white">
          {nearMeError}
        </p>
      )}
      <div className="relative z-0 h-[420px] overflow-hidden border-4 border-black shadow-brutal-lg sm:h-[520px]">
        <EventMap events={events} userLocation={userLocation} />
      </div>
    </section>
  );
}

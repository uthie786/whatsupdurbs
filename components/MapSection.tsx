"use client";

import type { DurbsEvent } from "@/types/event";
import { CATEGORY_COLORS } from "@/lib/areas";
import { EVENT_CATEGORIES } from "@/types/event";
import type { DateRange } from "@/lib/filters";
import DateRangePicker from "./DateRangePicker";
import EventMap from "./EventMap";
import NearMeButton from "./NearMeButton";
import type { LatLng } from "@/lib/geo";
import type { NearMeStatus } from "@/lib/useNearMe";

interface MapSectionProps {
  events: DurbsEvent[];
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  nearMeStatus?: NearMeStatus;
  onNearMeToggle?: () => void;
  nearMeError?: string | null;
  userLocation?: LatLng | null;
}

export default function MapSection({
  events,
  dateRange,
  onDateRangeChange,
  nearMeStatus,
  onNearMeToggle,
  nearMeError,
  userLocation,
}: MapSectionProps) {
  return (
    <section id="map" className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-3xl uppercase sm:text-4xl">
          <span className="bg-durbs-cyan px-2">Map</span> the vibe
        </h2>
        <ul className="flex flex-wrap gap-2" aria-label="Map legend">
          {EVENT_CATEGORIES.map((c) => (
            <li
              key={c}
              className="brutal-badge bg-white"
            >
              <span
                className="inline-block h-3 w-3 border-2 border-black"
                style={{ backgroundColor: CATEGORY_COLORS[c] }}
              />
              {c}
            </li>
          ))}
        </ul>
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

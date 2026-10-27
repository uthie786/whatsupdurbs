"use client";

import { useEffect, useState } from "react";
import { ChevronDown, SearchX } from "lucide-react";
import type { DurbsEvent } from "@/types/event";
import EventCard from "./EventCard";

/** Events shown at first, and added per "Show more". */
const PAGE_SIZE = 10;

interface EventGridProps {
  events: DurbsEvent[];
  loading?: boolean;
  onReset?: () => void;
  /** Distance (km) per event id when "near me" is on. */
  distances?: Map<string, number> | null;
  /** Overrides the default "nothing matches" text. */
  emptyMessage?: string;
}

/** Grid of already-filtered events (filters live in FilterBar / HomeClient). */
export default function EventGrid({
  events,
  loading = false,
  onReset,
  distances = null,
  emptyMessage,
}: EventGridProps) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  // New filters or search → start again from the first page.
  useEffect(() => setVisible(PAGE_SIZE), [events]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse border-3 border-black bg-neutral-100 shadow-brutal sm:h-80" />
        ))}
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="flex flex-col items-center gap-4 border-4 border-dashed border-black bg-white p-10 text-center">
        <SearchX className="h-10 w-10" />
        <p className="font-display text-2xl uppercase">{emptyMessage ? "Nothing saved yet." : "Eish, nothing matches."}</p>
        <p className="font-medium">{emptyMessage ?? "Try another area or date — Durbs is never really quiet."}</p>
        {onReset && (
          <button type="button" onClick={onReset} className="brutal-btn bg-durbs-cyan">
            Show everything
          </button>
        )}
      </div>
    );
  }

  const left = events.length - visible;
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
        {events.slice(0, visible).map((event) => (
          <EventCard key={event.id} event={event} distanceKm={distances?.get(event.id) ?? null} />
        ))}
      </div>
      {left > 0 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="brutal-btn bg-durbs-yellow"
          >
            <ChevronDown className="h-4 w-4" strokeWidth={3} /> Show more ({left} left)
          </button>
        </div>
      )}
    </div>
  );
}

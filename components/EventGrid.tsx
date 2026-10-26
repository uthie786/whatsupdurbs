"use client";

import { SearchX } from "lucide-react";
import type { DurbsEvent } from "@/types/event";
import EventCard from "./EventCard";

interface EventGridProps {
  events: DurbsEvent[];
  loading?: boolean;
  onReset?: () => void;
}

/** Grid of already-filtered events (filters live in FilterBar / HomeClient). */
export default function EventGrid({ events, loading = false, onReset }: EventGridProps) {
  if (loading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-80 animate-pulse border-3 border-black bg-neutral-100 shadow-brutal" />
        ))}
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="flex flex-col items-center gap-4 border-4 border-dashed border-black bg-white p-10 text-center">
        <SearchX className="h-10 w-10" />
        <p className="font-display text-2xl uppercase">Eish, nothing matches.</p>
        <p className="font-medium">Try another area or date — Durbs is never really quiet.</p>
        {onReset && (
          <button type="button" onClick={onReset} className="brutal-btn bg-durbs-cyan">
            Show everything
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, Sparkles, Ticket } from "lucide-react";
import type { DurbsEvent } from "@/types/event";
import { CATEGORY_BG } from "@/lib/areas";
import { formatEventDate } from "@/lib/filters";
import EventImage from "./EventImage";

const AUTO_ADVANCE_MS = 6000;

export default function FeaturedCarousel({ events }: { events: DurbsEvent[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = events.length;

  const go = useCallback(
    (delta: number) => setIndex((i) => (count ? (i + delta + count) % count : 0)),
    [count],
  );

  useEffect(() => {
    if (count < 2 || paused) return;
    const id = setInterval(() => go(1), AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [count, paused, go]);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  if (!count) return null;
  const event = events[Math.min(index, count - 1)];

  return (
    <section
      className="mx-auto max-w-7xl px-4 py-10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured events"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-3xl uppercase leading-none sm:text-4xl">
          Featured Durban <span className="bg-durbs-pink px-2 text-white">Spots</span> & Events
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => go(-1)}
            className="brutal-btn bg-white !px-3"
            aria-label="Previous featured event"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={3} />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className="brutal-btn bg-durbs-yellow !px-3"
            aria-label="Next featured event"
          >
            <ArrowRight className="h-5 w-5" strokeWidth={3} />
          </button>
        </div>
      </div>

      <article
        key={event.id}
        className="grid overflow-hidden border-4 border-black bg-white shadow-brutal-xl md:grid-cols-5"
      >
        <div className="relative md:col-span-3">
          <EventImage
            src={event.image_url}
            alt={event.title}
            category={event.category}
            className="h-64 w-full border-b-4 border-black sm:h-80 md:h-full md:min-h-[380px] md:border-b-0 md:border-r-4"
          />
          <span className="brutal-badge absolute left-4 top-4 -rotate-2 bg-durbs-yellow px-3 py-1 text-xs shadow-[0_0_18px_4px_rgba(255,230,0,0.85),3px_3px_0_0_#000]">
            <Sparkles className="h-3.5 w-3.5" /> Sponsored / Featured
          </span>
        </div>
        <div className="flex flex-col gap-4 p-6 md:col-span-2">
          <span className={`brutal-badge self-start ${CATEGORY_BG[event.category]}`}>
            {event.category}
          </span>
          <h3 className="font-display text-3xl uppercase leading-tight">{event.title}</h3>
          <p className="font-medium text-neutral-800">{event.description}</p>
          <ul className="space-y-1.5 text-sm font-bold">
            <li className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0" /> {formatEventDate(event)}
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" /> {event.venue_name} · {event.area}
            </li>
            {event.price_text && (
              <li className="inline-block self-start bg-durbs-cyan px-2">{event.price_text}</li>
            )}
          </ul>
          <div className="mt-auto flex flex-wrap items-center gap-3">
            {event.ticket_url && (
              <a
                href={event.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                className="brutal-btn bg-durbs-pink text-white"
              >
                <Ticket className="h-4 w-4" /> Get Tickets
              </a>
            )}
            <div className="flex gap-1.5" role="tablist" aria-label="Choose featured event">
              {events.map((e, i) => (
                <button
                  key={e.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Show ${e.title}`}
                  onClick={() => setIndex(i)}
                  className={`h-3.5 w-3.5 border-2 border-black transition-colors ${
                    i === index ? "bg-black" : "bg-white hover:bg-durbs-yellow"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}

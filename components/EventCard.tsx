"use client";

import { CalendarDays, MapPin, Star, Ticket } from "lucide-react";
import type { DurbsEvent } from "@/types/event";
import { CATEGORY_BG } from "@/lib/areas";
import { formatEventDate } from "@/lib/filters";
import EventImage from "./EventImage";

export default function EventCard({ event }: { event: DurbsEvent }) {
  return (
    <article className="group flex flex-col border-3 border-black bg-white shadow-brutal transition-all duration-150 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-lg">
      <div className="relative">
        <EventImage
          src={event.image_url}
          alt={event.title}
          category={event.category}
          className="h-44 w-full border-b-3 border-black"
        />
        <span className={`brutal-badge absolute left-3 top-3 ${CATEGORY_BG[event.category]}`}>
          {event.category}
        </span>
        {event.is_featured && (
          <span className="brutal-badge absolute right-3 top-3 bg-durbs-yellow">
            <Star className="h-3 w-3 fill-black" /> Featured
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-display text-lg uppercase leading-tight">{event.title}</h3>
        <p className="line-clamp-2 text-sm font-medium text-neutral-700">{event.description}</p>
        <ul className="mt-1 space-y-1 text-xs font-bold">
          <li className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" /> {formatEventDate(event)}
          </li>
          <li className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" /> {event.venue_name} · {event.area}
          </li>
        </ul>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="border-2 border-black bg-durbs-cyan px-2 py-0.5 text-xs font-black">
            {event.price_text || "TBC"}
          </span>
          {event.ticket_url ? (
            <a
              href={event.ticket_url}
              target="_blank"
              rel="noopener noreferrer"
              className="brutal-btn bg-durbs-pink !px-3 !py-1.5 !text-xs text-white"
            >
              <Ticket className="h-3.5 w-3.5" /> Tickets
            </a>
          ) : (
            <span className="text-xs font-black uppercase">Just pitch up 🤙</span>
          )}
        </div>
      </div>
    </article>
  );
}

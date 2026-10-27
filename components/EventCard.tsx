"use client";

import Link from "next/link";
import { CalendarDays, MapPin, Navigation, Star, Ticket } from "lucide-react";
import type { DurbsEvent } from "@/types/event";
import { CATEGORY_BG } from "@/lib/areas";
import { formatEventDate } from "@/lib/filters";
import { formatDistance } from "@/lib/geo";
import { eventPath } from "@/lib/site";
import EventImage from "./EventImage";
import SaveButton from "./SaveButton";
import AddToCalendar from "./AddToCalendar";

interface EventCardProps {
  event: DurbsEvent;
  /** Kilometres from the visitor, when "near me" is on. */
  distanceKm?: number | null;
}

export default function EventCard({ event, distanceKm = null }: EventCardProps) {
  const href = eventPath(event);
  return (
    <article className="group flex flex-col border-3 border-black bg-white shadow-brutal transition-all duration-150 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-lg">
      <div className="relative">
        <Link href={href} aria-label={event.title} tabIndex={-1}>
          <EventImage
            src={event.image_url}
            alt={event.title}
            category={event.category}
            className="h-44 w-full border-b-3 border-black"
          />
        </Link>
        <span className={`brutal-badge absolute left-3 top-3 ${CATEGORY_BG[event.category]}`}>
          {event.category}
        </span>
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {event.is_featured && (
            <span className="brutal-badge bg-durbs-yellow">
              <Star className="h-3 w-3 fill-black" /> Featured
            </span>
          )}
          <SaveButton eventId={event.id} title={event.title} />
        </div>
        {distanceKm !== null && (
          <span className="brutal-badge absolute bottom-3 left-3 bg-black text-white">
            <Navigation className="h-3 w-3" /> {formatDistance(distanceKm)} away
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-display text-lg uppercase leading-tight">
          <Link href={href} className="hover:underline hover:decoration-4 hover:underline-offset-4">
            {event.title}
          </Link>
        </h3>
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
          <div className="flex items-center gap-2">
            <AddToCalendar event={event} compact />
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
              <Link href={href} className="brutal-btn bg-white !px-3 !py-1.5 !text-xs">
                Details
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

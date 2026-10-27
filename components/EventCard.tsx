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
    <article className="group flex min-w-0 flex-col border-3 border-black bg-white shadow-brutal transition-all duration-150 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-lg">
      <div className="relative">
        <Link href={href} aria-label={event.title} tabIndex={-1}>
          <EventImage
            src={event.image_url}
            alt={event.title}
            category={event.category}
            className="h-28 w-full border-b-3 border-black sm:h-44"
          />
        </Link>
        <span
          className={`brutal-badge absolute left-2 top-2 !px-1.5 !text-[9px] sm:left-3 sm:top-3 sm:!px-2 sm:!text-[11px] ${CATEGORY_BG[event.category]}`}
        >
          {event.category}
        </span>
        <div className="absolute right-2 top-2 flex items-center gap-1.5 sm:right-3 sm:top-3">
          {event.is_featured && (
            <span className="brutal-badge bg-durbs-yellow !px-1.5 sm:!px-2" title="Featured">
              <Star className="h-3 w-3 fill-black" /> <span className="hidden sm:inline">Featured</span>
            </span>
          )}
          <SaveButton eventId={event.id} title={event.title} />
        </div>
        {distanceKm !== null && (
          <span className="brutal-badge absolute bottom-2 left-2 bg-black !text-[9px] text-white sm:bottom-3 sm:left-3 sm:!text-[11px]">
            <Navigation className="h-3 w-3" /> {formatDistance(distanceKm)} away
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5 sm:gap-2 sm:p-4">
        <h3 className="line-clamp-2 font-display text-sm uppercase leading-tight sm:text-lg">
          <Link href={href} className="hover:underline hover:decoration-4 hover:underline-offset-4">
            {event.title}
          </Link>
        </h3>
        <p className="hidden text-sm font-medium text-neutral-700 sm:line-clamp-2">{event.description}</p>
        <ul className="mt-1 space-y-1 text-[11px] font-bold sm:text-xs">
          <li className="flex min-w-0 items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{formatEventDate(event)}</span>
          </li>
          <li className="flex min-w-0 items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {event.venue_name}
              <span className="hidden sm:inline"> · {event.area}</span>
            </span>
          </li>
        </ul>
        <div className="mt-auto flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between sm:pt-3">
          <span className="max-w-full self-start truncate border-2 border-black bg-durbs-cyan px-2 py-0.5 text-[11px] font-black sm:self-auto sm:text-xs">
            {event.price_text || "TBC"}
          </span>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <AddToCalendar event={event} compact />
            </div>
            {event.ticket_url ? (
              <a
                href={event.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                className="brutal-btn w-full bg-durbs-pink !px-2 !py-1.5 !text-[11px] text-white sm:w-auto sm:!px-3 sm:!text-xs"
              >
                <Ticket className="h-3.5 w-3.5" /> Tickets
              </a>
            ) : (
              <Link
                href={href}
                className="brutal-btn w-full bg-white !px-2 !py-1.5 !text-[11px] sm:w-auto sm:!px-3 sm:!text-xs"
              >
                Details
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

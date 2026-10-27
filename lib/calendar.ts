import type { DurbsEvent } from "@/types/event";
import { isTimeUnknown, sastDayKey } from "@/lib/time";
import { eventUrl } from "@/lib/site";

/** Events without an end time are assumed to last this long. */
const DEFAULT_LENGTH_MS = 3 * 60 * 60 * 1000;

interface CalendarTimes {
  allDay: boolean;
  /** UTC stamps (YYYYMMDDTHHMMSSZ) or, for all-day events, SAST dates (YYYYMMDD). */
  start: string;
  end: string;
}

const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dayStamp = (d: Date) => sastDayKey(d).replace(/-/g, "");

function calendarTimes(event: DurbsEvent): CalendarTimes {
  const start = new Date(event.start_date);
  const end = event.end_date ? new Date(event.end_date) : null;
  if (!end && isTimeUnknown(start)) {
    // No time on the listing: block out the whole day.
    const next = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { allDay: true, start: dayStamp(start), end: dayStamp(next) };
  }
  const finish = end && end > start ? end : new Date(start.getTime() + DEFAULT_LENGTH_MS);
  return { allDay: false, start: utcStamp(start), end: utcStamp(finish) };
}

function location(event: DurbsEvent): string {
  return [event.venue_name, event.address, event.area, "Durban"].filter(Boolean).join(", ");
}

function details(event: DurbsEvent): string {
  return [
    event.description,
    event.price_text ? `Price: ${event.price_text}` : "",
    event.ticket_url ? `Tickets: ${event.ticket_url}` : "",
    `More: ${eventUrl(event)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function googleCalendarUrl(event: DurbsEvent): string {
  const t = calendarTimes(event);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${t.start}/${t.end}`,
    details: details(event),
    location: location(event),
    ctz: "Africa/Johannesburg",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 lines are limited to 75 octets; continuation lines start with a space. */
function fold(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = "";
  for (const ch of line) {
    if (bytes.encode(current + ch).length > (out.length ? 74 : 75)) {
      out.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.join("\r\n ");
}

/** An .ics file (Apple Calendar, Outlook, etc.) for one event. */
export function icsFile(event: DurbsEvent, now = new Date()): string {
  const t = calendarTimes(event);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WhatsUpDurbs//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@whatsupdurbs`,
    `DTSTAMP:${utcStamp(now)}`,
    t.allDay ? `DTSTART;VALUE=DATE:${t.start}` : `DTSTART:${t.start}`,
    t.allDay ? `DTEND;VALUE=DATE:${t.end}` : `DTEND:${t.end}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(details(event))}`,
    `LOCATION:${escapeText(location(event))}`,
    `URL:${eventUrl(event)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function icsFilename(event: DurbsEvent): string {
  return `${event.slug || "event"}.ics`;
}

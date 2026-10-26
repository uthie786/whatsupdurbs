import {
  addDays,
  endOfDay,
  format,
  isSameDay,
  isToday,
  isWithinInterval,
  nextFriday,
  parseISO,
  startOfDay,
} from "date-fns";
import type {
  AreaFilter,
  CategoryFilter,
  DateFilter,
  DurbsEvent,
} from "@/types/event";
import { areaMatches } from "@/lib/areas";

/** True when an event overlaps the [from, to] window. */
function overlaps(event: DurbsEvent, from: Date, to: Date): boolean {
  const start = parseISO(event.start_date);
  const end = event.end_date ? parseISO(event.end_date) : start;
  return start <= to && end >= from;
}

/** Friday 00:00 to Sunday 23:59 of the current (or upcoming) weekend. */
export function weekendWindow(now = new Date()): { from: Date; to: Date } {
  const day = now.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat
  let friday: Date;
  if (day === 5) friday = now;
  else if (day === 6) friday = addDays(now, -1);
  else if (day === 0) friday = addDays(now, -2);
  else friday = nextFriday(now);
  return { from: startOfDay(friday), to: endOfDay(addDays(friday, 2)) };
}

/** Durban festive season: 1 December to 15 January. */
export function festiveWindow(now = new Date()): { from: Date; to: Date } {
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return {
    from: new Date(year, 11, 1),
    to: endOfDay(new Date(year + 1, 0, 15)),
  };
}

export function dateMatches(
  filter: DateFilter,
  event: DurbsEvent,
  now = new Date(),
): boolean {
  switch (filter) {
    case "All":
      return true;
    case "Today": {
      const start = parseISO(event.start_date);
      if (isToday(start)) return true;
      return overlaps(event, startOfDay(now), endOfDay(now));
    }
    case "This Weekend": {
      const { from, to } = weekendWindow(now);
      return overlaps(event, from, to);
    }
    case "Festive Season": {
      const { from, to } = festiveWindow(now);
      return (
        event.category === "Festive" ||
        isWithinInterval(parseISO(event.start_date), { start: from, end: to })
      );
    }
  }
}

export interface EventFilters {
  search: string;
  category: CategoryFilter;
  date: DateFilter;
  area: AreaFilter;
}

export function filterEvents(events: DurbsEvent[], f: EventFilters): DurbsEvent[] {
  const q = f.search.trim().toLowerCase();
  return events.filter((e) => {
    if (f.category !== "All" && e.category !== f.category) return false;
    if (!areaMatches(f.area, e.area)) return false;
    if (!dateMatches(f.date, e)) return false;
    if (q) {
      const haystack = `${e.title} ${e.venue_name} ${e.area} ${e.description} ${e.category}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function formatEventDate(event: DurbsEvent): string {
  const start = parseISO(event.start_date);
  if (!event.end_date) {
    // Imported listings without a known time are stored at midnight.
    const timeKnown = start.getHours() !== 0 || start.getMinutes() !== 0;
    return format(start, "EEE d MMM") + (timeKnown ? format(start, " · HH:mm") : " · Time TBC");
  }
  const end = parseISO(event.end_date);
  if (isSameDay(start, end)) {
    return `${format(start, "EEE d MMM · HH:mm")}–${format(end, "HH:mm")}`;
  }
  return `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

import type { DurbsEvent } from "@/types/event";
import { sastDayKey } from "@/lib/time";

// Words that say little about which event it is.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "of", "at", "in", "on", "with", "for", "to", "by", "live",
  "durban", "dbn", "event", "presents", "tour", "edition", "2025", "2026", "2027", "night",
]);

function tokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOPWORDS.has(w)),
  );
}

/** How alike two titles are, 0..1. One title's words all appearing in the other counts as 1. */
export function titleSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  ta.forEach((w) => {
    if (tb.has(w)) shared++;
  });
  const containment = shared / Math.min(ta.size, tb.size);
  const jaccard = shared / (ta.size + tb.size - shared);
  // Containment only counts when the shorter title has some substance.
  return Math.min(ta.size, tb.size) >= 2 ? Math.max(jaccard, containment) : jaccard;
}

/** Days (SAST) an event touches, capped so long-running events don't match everything. */
function eventDays(e: Pick<DurbsEvent, "start_date" | "end_date">): Set<string> {
  const start = new Date(e.start_date);
  const end = e.end_date ? new Date(e.end_date) : start;
  const days = new Set<string>();
  for (let t = start.getTime(), i = 0; t <= end.getTime() && i < 14; t += 86_400_000, i++) {
    days.add(sastDayKey(new Date(t)));
  }
  days.add(sastDayKey(end));
  return days;
}

export type DuplicateCandidate = Pick<DurbsEvent, "title" | "start_date" | "end_date"> & { id?: string };

/** Existing events that look like the same event (similar title, overlapping day). */
export function findLikelyDuplicates<T extends DuplicateCandidate>(
  event: DuplicateCandidate,
  others: T[],
  threshold = 0.6,
): T[] {
  const days = eventDays(event);
  return others.filter((o) => {
    if (event.id && o.id === event.id) return false;
    if (titleSimilarity(event.title, o.title) < threshold) return false;
    for (const d of Array.from(eventDays(o))) if (days.has(d)) return true;
    return false;
  });
}

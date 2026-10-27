// Quicket public events API → WhatsUpDurbs events.
// Docs: https://docs.quicket.com (GET /api/events?api_key=…&pageSize=…&page=…&lastModified=…)
import type { DurbanArea, DurbsEvent, EventCategory } from "@/types/event";
import { AREA_COORDS, DURBAN_CENTER } from "@/lib/areas";
import { slugify } from "@/lib/filters";
import { distanceKm } from "@/lib/geo";

const QUICKET_API = "https://api.quicket.co.za/api";

/** Ballito in the north to Amanzimtoti in the south, inland to Hillcrest. */
export const DURBAN_RADIUS_KM = 45;

export interface QuicketTicket {
  price?: number | null;
  soldOut?: boolean;
  donation?: boolean;
}

export interface QuicketEvent {
  id: number;
  name: string;
  description?: string | null;
  url?: string | null;
  imageUrl?: string | null;
  startDate: string;
  endDate?: string | null;
  venue?: {
    name?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
  } | null;
  locality?: { levelOne?: string | null; levelTwo?: string | null; levelThree?: string | null } | null;
  categories?: { id: number; name: string }[] | null;
  tickets?: QuicketTicket[] | null;
}

export interface QuicketListResult {
  results: QuicketEvent[] | null;
  pageSize: number;
  pages: number;
  records: number;
  statusCode?: number;
  message?: string;
}

export type QuicketEventRow = Omit<DurbsEvent, "id" | "is_featured" | "is_approved" | "created_at"> & {
  source: "quicket";
  external_id: string;
};

/** Quicket's own server gives up after ~30s; don't wait much longer than that. */
const REQUEST_TIMEOUT_MS = 40_000;

export class QuicketApiError extends Error {
  constructor(
    readonly status: number,
    body: string,
    context: string,
  ) {
    super(`Quicket API ${status} (${context}): ${body}`);
  }
}

async function quicketGet<T>(path: string, params: Record<string, string>, context: string): Promise<T> {
  const key = process.env.QUICKET_API_KEY;
  if (!key) throw new Error("QUICKET_API_KEY is not set");
  const qs = new URLSearchParams({ api_key: key, ...params });
  let res: Response;
  try {
    res = await fetch(`${QUICKET_API}${path}?${qs}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new QuicketApiError(504, `no response within ${REQUEST_TIMEOUT_MS / 1000}s`, context);
    }
    throw err;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new QuicketApiError(res.status, body.slice(0, 200), context);
  }
  return (await res.json()) as T;
}

/**
 * Events modified since `since`. Quicket's list query times out on its side
 * for anything more than a couple of hours of changes, so keep windows small.
 */
export function fetchQuicketPage(
  page: number,
  since: Date,
  pageSize = 100,
): Promise<QuicketListResult> {
  return quicketGet<QuicketListResult>(
    "/events",
    { pageSize: String(pageSize), page: String(page), lastModified: quicketDateParam(since) },
    `events modified since ${quicketDateParam(since)}, page ${page}`,
  );
}

/** Quicket documents the `lastModified` format as `yyyy-MM-ddTHH:mm:ss.zzZ`. */
export function quicketDateParam(d: Date): string {
  return `${d.toISOString().slice(0, 19)}.00Z`;
}

/* ------------------------------ Mapping ------------------------------ */

export function isInDurbanRegion(lat: number, lng: number): boolean {
  return distanceKm(DURBAN_CENTER, [lat, lng]) <= DURBAN_RADIUS_KM;
}

export function nearestArea(lat: number, lng: number): DurbanArea {
  let best: DurbanArea = "Central Beachfront";
  let bestDist = Infinity;
  for (const [area, coords] of Object.entries(AREA_COORDS) as [DurbanArea, [number, number]][]) {
    const d = distanceKm(coords, [lat, lng]);
    if (d < bestDist) {
      best = area;
      bestDist = d;
    }
  }
  return best;
}

function isFestiveDate(value: string): boolean {
  const d = parseQuicketDate(value);
  if (!d) return false;
  const m = d.getUTCMonth();
  return m === 11 || (m === 0 && d.getUTCDate() <= 15);
}

// Most specific first: a "car show" is Cars, not Concerts ("show"); a "food market" is Food, not Markets.
const CATEGORY_RULES: [EventCategory, RegExp][] = [
  ["Festive", /christmas|festive|new year|xmas|carol|santa/],
  ["Cars", /\bcars?\b|car meet|car show|motor|spinn?ing|\bspin\b|drift|auto ?show|show (and|&|n) shine|petrolhead|track day|rally|supercar|bikers?\b/],
  ["Fitness", /parkrun|park run|fun ?run|\brun\b|marathon|\b\d+ ?k(m)? (run|walk)|race|triathlon|tinman|cycl|\bride\b|yoga|pilates|bootcamp|fitness|crossfit|swim|sport/],
  ["Outdoors", /hike|hiking|trail|outdoor|adventure|paintball|camping|kayak|surf|beach clean|nature|travel/],
  ["Family", /\bkids?\b|children|family|toddler|school holiday/],
  ["Social", /meet-?up|mixer|singles|speed dating|social club|book club|board games?|games night|quiz night|trivia|get-?together/],
  ["Workshops", /workshop|class(es)?\b|course|masterclass|seminar|conference|talk\b|networking|summit|training|business/],
  ["Theatre", /comedy|comedian|stand-?up|theatre|theater|musical|\bplay\b|ballet|dance show|poetry|cinderella|panto|improv/],
  ["Arts", /exhibition|gallery|\bart\b|arts|film|cinema|screening|museum|culture/],
  ["Food", /food|wine|beer|gin|whisky|brunch|braai|tasting|culinary|dining|cook/],
  ["Markets", /market|expo|fair|craft|flea|bazaar/],
  ["Nightlife", /party|club|nightlife|\bdj\b|rave|amapiano|gqom|lounge/],
  ["Concerts", /music|concert|festival|live|gig|tour|choir|gospel|jazz|orchestra|worship/],
];

export function mapCategory(e: QuicketEvent): EventCategory {
  const cats = (e.categories ?? []).map((c) => c.name).join(" ");
  const text = `${e.name} ${cats}`.toLowerCase();
  for (const [category, pattern] of CATEGORY_RULES) {
    if (pattern.test(text)) return category;
  }
  if (isFestiveDate(e.startDate)) return "Festive";
  return "Popups";
}

export function priceText(tickets: QuicketTicket[] | null | undefined): string | null {
  const prices = (tickets ?? [])
    .filter((t) => !t.donation && typeof t.price === "number" && Number.isFinite(t.price))
    .map((t) => t.price as number);
  if (!prices.length) return null;
  const min = Math.min(...prices);
  if (min <= 0) return prices.some((p) => p > 0) ? "Free & paid options" : "Free";
  return `From R${Math.round(min)}`;
}

export function stripHtml(html: string | null | undefined, max = 400): string {
  if (!html) return "";
  const text = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Quicket returns local SA times, often without an offset; pin those to SAST. */
export function parseQuicketDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  let v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) v += "T00:00:00";
  const hasZone = /T.*(Z|[+-]\d{2}:?\d{2})$/i.test(v);
  const d = new Date(hasZone ? v : `${v}+02:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Quicket image URLs are protocol-relative (`//images.quicket.co.za/…`). */
export function normalizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http://")) return `https://${url.slice(7)}`;
  return url;
}

function toNumber(v: number | string | null | undefined): number | null {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n !== 0 ? n : null;
}

export type SkipReason = "no-location" | "outside-durban" | "past" | "invalid";

/** Map a Quicket event to a row, or say why it was skipped. */
export function mapQuicketEvent(
  e: QuicketEvent,
  now = new Date(),
): { row: QuicketEventRow } | { skip: SkipReason } {
  const start = parseQuicketDate(e?.startDate);
  if (!e?.id || !e.name || !start) return { skip: "invalid" };
  const lat = toNumber(e.venue?.latitude);
  const lng = toNumber(e.venue?.longitude);
  if (lat === null || lng === null) return { skip: "no-location" };
  if (!isInDurbanRegion(lat, lng)) return { skip: "outside-durban" };

  const end = parseQuicketDate(e.endDate);
  if ((end ?? start) < now) return { skip: "past" };

  const address = [e.venue?.addressLine1, e.venue?.addressLine2, e.locality?.levelThree]
    .filter(Boolean)
    .join(", ");

  return {
    row: {
      title: e.name.trim(),
      slug: `${slugify(e.name) || "event"}-q${e.id}`,
      description: stripHtml(e.description),
      category: mapCategory(e),
      venue_name: e.venue?.name?.trim() || "Venue TBC",
      address,
      area: nearestArea(lat, lng),
      latitude: lat,
      longitude: lng,
      start_date: start.toISOString(),
      end_date: end && end > start ? end.toISOString() : null,
      image_url: normalizeImageUrl(e.imageUrl),
      ticket_url: e.url || null,
      price_text: priceText(e.tickets),
      source: "quicket",
      external_id: String(e.id),
    },
  };
}

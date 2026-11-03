// Server-only: look up a venue/address with OpenStreetMap's Nominatim (free, no key).
// Usage policy: identify the app, at most ~1 request per second, cache results.
// https://operations.osmfoundation.org/policies/nominatim/
import { SITE_URL } from "@/lib/site";
import { distanceKm } from "@/lib/geo";
import { DURBAN_CENTER } from "@/lib/areas";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
/** Ballito to Amanzimtoti, inland past Hillcrest (lon/lat: west, north, east, south). */
const VIEWBOX = "30.55,-29.35,31.45,-30.25";
const MAX_KM = 60;

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
}

interface NominatimHit {
  lat: string;
  lon: string;
  display_name: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Queries to try, most specific first, without repeats. */
export function geocodeQueries(venue: string, address: string): string[] {
  const v = venue.trim();
  const a = address.trim();
  const withCity = (q: string) => (/durban|kzn|kwazulu|umhlanga|ballito|westville|pinetown|hillcrest/i.test(q) ? q : `${q}, Durban`);
  const list = [v && a ? `${v}, ${a}` : "", a ? withCity(a) : "", v ? withCity(v) : ""].filter(Boolean);
  return [...new Set(list)];
}

/** Keep hits in the Durban region, nearest-first order as returned. */
export function parseHits(hits: NominatimHit[]): GeocodeResult[] {
  return hits
    .map((h) => ({ lat: Number(h.lat), lng: Number(h.lon), label: h.display_name }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && distanceKm(DURBAN_CENTER, [r.lat, r.lng]) <= MAX_KM);
}

async function search(q: string): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({
    q,
    format: "jsonv2",
    countrycodes: "za",
    viewbox: VIEWBOX,
    bounded: "1",
    limit: "5",
  });
  const res = await fetch(`${NOMINATIM}?${params}`, {
    headers: { "User-Agent": `WhatsUpDurbs/1.0 (+${SITE_URL})`, Referer: SITE_URL, "Accept-Language": "en" },
    signal: AbortSignal.timeout(8000),
    // Same address → same answer; cache a day to go easy on the free service.
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`Address lookup failed (${res.status}).`);
  return parseHits((await res.json()) as NominatimHit[]);
}

/** Up to 5 candidate locations for a venue/address in greater Durban (best first). */
export async function geocodeVenue(venue: string, address: string): Promise<GeocodeResult[]> {
  const queries = geocodeQueries(venue, address);
  for (let i = 0; i < queries.length; i++) {
    if (i > 0) await sleep(1100);
    const hits = await search(queries[i]);
    if (hits.length) return hits;
  }
  return [];
}

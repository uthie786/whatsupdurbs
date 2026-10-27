import type { DurbsEvent } from "@/types/event";
import { AREA_COORDS, DURBAN_CENTER } from "@/lib/areas";

export type LatLng = [number, number];

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Venue coordinates, falling back to the area centre when they're missing. */
export function eventPosition(event: DurbsEvent): LatLng {
  const lat = Number(event.latitude);
  const lng = Number(event.longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
  return hasCoords ? [lat, lng] : AREA_COORDS[event.area] ?? DURBAN_CENTER;
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

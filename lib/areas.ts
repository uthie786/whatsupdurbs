import type { AreaFilter, DurbanArea, EventCategory } from "@/types/event";

export const DURBAN_CENTER: [number, number] = [-29.8587, 31.0218];

export const AREA_COORDS: Record<DurbanArea, [number, number]> = {
  Umhlanga: [-29.7262, 31.0849],
  Morningside: [-29.8261, 31.0164],
  "Durban North": [-29.7896, 31.0322],
  Ballito: [-29.5389, 31.2144],
  "Central Beachfront": [-29.8579, 31.0384],
  "Point Waterfront": [-29.8686, 31.0464],
};

export const AREA_FILTERS: AreaFilter[] = [
  "All Areas",
  "Umhlanga",
  "Morningside",
  "Durban North",
  "Ballito",
  "Beachfront",
];

/** "Beachfront" groups both the central beachfront and the Point waterfront. */
export function areaMatches(filter: AreaFilter, area: DurbanArea): boolean {
  if (filter === "All Areas") return true;
  if (filter === "Beachfront") {
    return area === "Central Beachfront" || area === "Point Waterfront";
  }
  return filter === area;
}

export const CATEGORY_COLORS: Record<EventCategory, string> = {
  Markets: "#FFE600",
  Concerts: "#FF2E93",
  Popups: "#00F0FF",
  Nightlife: "#8A2BE2",
  Festive: "#22C55E",
};

export const CATEGORY_BG: Record<EventCategory, string> = {
  Markets: "bg-durbs-yellow text-black",
  Concerts: "bg-durbs-pink text-white",
  Popups: "bg-durbs-cyan text-black",
  Nightlife: "bg-durbs-purple text-white",
  Festive: "bg-green-500 text-black",
};

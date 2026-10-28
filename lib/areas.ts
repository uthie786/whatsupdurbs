import type { AreaFilter, DurbanArea, EventCategory } from "@/types/event";

export const DURBAN_CENTER: [number, number] = [-29.8587, 31.0218];

export const AREA_COORDS: Record<DurbanArea, [number, number]> = {
  Umhlanga: [-29.7262, 31.0849],
  Morningside: [-29.8261, 31.0164],
  "Durban North": [-29.7896, 31.0322],
  Ballito: [-29.5389, 31.2144],
  "Central Beachfront": [-29.8579, 31.0384],
  "Point Waterfront": [-29.8686, 31.0464],
  "CBD & Berea": [-29.855, 31.016],
  Westville: [-29.838, 30.929],
  Pinetown: [-29.818, 30.865],
  // Hillcrest, Kloof, Gillitts, Botha's Hill
  "Upper Highway": [-29.78, 30.79],
  // eMdloti / Umdloti village and La Mercy
  eMdloti: [-29.665, 31.112],
};

export const AREA_FILTERS: AreaFilter[] = [
  "All Areas",
  "Ballito",
  "eMdloti",
  "Umhlanga",
  "Durban North",
  "Morningside",
  "CBD & Berea",
  "Beachfront",
  "Westville",
  "Pinetown",
  "Upper Highway",
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
  Nightlife: "#8A2BE2",
  Festive: "#22C55E",
  Popups: "#00F0FF",
  Fitness: "#FF8A00",
  Outdoors: "#A3E635",
  Cars: "#FF3B30",
  Food: "#FFB020",
  Theatre: "#3B82F6",
  Arts: "#F472B6",
  Family: "#14B8A6",
  Social: "#C084FC",
  Workshops: "#94A3B8",
};

/** Badge background + readable text colour per category. */
export const CATEGORY_BG: Record<EventCategory, string> = {
  Markets: "bg-durbs-yellow text-black",
  Concerts: "bg-durbs-pink text-white",
  Nightlife: "bg-durbs-purple text-white",
  Festive: "bg-green-500 text-black",
  Popups: "bg-durbs-cyan text-black",
  Fitness: "bg-[#FF8A00] text-black",
  Outdoors: "bg-[#A3E635] text-black",
  Cars: "bg-[#FF3B30] text-white",
  Food: "bg-[#FFB020] text-black",
  Theatre: "bg-[#3B82F6] text-white",
  Arts: "bg-[#F472B6] text-black",
  Family: "bg-[#14B8A6] text-black",
  Social: "bg-[#C084FC] text-black",
  Workshops: "bg-[#94A3B8] text-black",
};

/** Emoji for chips/menus and what each category covers (also guides the poster AI). */
export const CATEGORY_INFO: Record<EventCategory, { emoji: string; covers: string }> = {
  Markets: { emoji: "🛍️", covers: "markets, expos, fairs, flea and craft markets" },
  Concerts: { emoji: "🎤", covers: "live music, gigs, gospel, choirs and orchestras" },
  Nightlife: { emoji: "🪩", covers: "parties, clubs, DJ nights, amapiano and gqom" },
  Festive: { emoji: "🎄", covers: "Christmas, New Year and December holiday events" },
  Popups: { emoji: "⚡", covers: "one-off pop-ups, launches and anything that fits nowhere else" },
  Fitness: { emoji: "🏃", covers: "park runs, fun runs, races, marathons, cycling, yoga and bootcamps" },
  Outdoors: { emoji: "🌿", covers: "hikes, trail days, beach clean-ups, paintball and adventure activities" },
  Cars: { emoji: "🚗", covers: "car meets, car shows, spinning and drift days, motorsport and bike rallies" },
  Food: { emoji: "🍔", covers: "food and wine festivals, braais, tastings and brunches" },
  Theatre: { emoji: "🎭", covers: "comedy, plays, musicals, dance shows and poetry" },
  Arts: { emoji: "🎨", covers: "exhibitions, galleries, film screenings and culture" },
  Family: { emoji: "👨‍👩‍👧", covers: "kids' days, family fun and school holiday activities" },
  Social: { emoji: "🤝", covers: "social meetups, singles mixers, book and board-game clubs, community get-togethers" },
  Workshops: { emoji: "🛠️", covers: "classes, courses, talks and business networking" },
};

/** "🏃 Fitness" */
export function categoryLabel(category: EventCategory): string {
  return `${CATEGORY_INFO[category].emoji} ${category}`;
}

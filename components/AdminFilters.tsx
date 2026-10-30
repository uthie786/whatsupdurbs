"use client";

import { MapPin, Search, Star, X } from "lucide-react";
import { DURBAN_AREAS, EVENT_CATEGORIES, type DurbanArea, type DurbsEvent, type EventCategory } from "@/types/event";
import { categoryLabel } from "@/lib/areas";
import ScrollRow from "./ScrollRow";

export interface AdminFilterState {
  query: string;
  area: "all" | DurbanArea;
  categories: ReadonlySet<EventCategory>;
  featuredOnly: boolean;
}

export const EMPTY_ADMIN_FILTERS: AdminFilterState = {
  query: "",
  area: "all",
  categories: new Set(),
  featuredOnly: false,
};

export function isAdminFilterActive(f: AdminFilterState): boolean {
  return f.query.trim() !== "" || f.area !== "all" || f.categories.size > 0 || f.featuredOnly;
}

/** Name/venue search, exact area, any of the chosen categories, featured. */
export function matchesAdminFilters(e: DurbsEvent, f: AdminFilterState): boolean {
  const q = f.query.trim().toLowerCase();
  if (q && !`${e.title} ${e.venue_name} ${e.address}`.toLowerCase().includes(q)) return false;
  if (f.area !== "all" && e.area !== f.area) return false;
  if (f.categories.size > 0 && !f.categories.has(e.category)) return false;
  if (f.featuredOnly && !e.is_featured) return false;
  return true;
}

interface AdminFiltersProps {
  value: AdminFilterState;
  onChange: (next: AdminFilterState) => void;
  /** Events in the current tab, for the per-area counts. */
  tabEvents: DurbsEvent[];
}

export default function AdminFilters({ value, onChange, tabEvents }: AdminFiltersProps) {
  const set = (patch: Partial<AdminFilterState>) => onChange({ ...value, ...patch });
  const toggleCategory = (c: EventCategory) => {
    const next = new Set(value.categories);
    if (!next.delete(c)) next.add(c);
    set({ categories: next });
  };
  const areaCount = (a: DurbanArea) => tabEvents.filter((e) => e.area === a).length;

  return (
    <div className="space-y-3 border-4 border-black bg-durbs-yellow p-3 shadow-brutal-lg sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search by name or venue</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            type="search"
            value={value.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder="Search by event name or venue…"
            className="brutal-input pl-9"
          />
        </label>
        <label className="relative sm:w-64">
          <span className="sr-only">Area</span>
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <select
            value={value.area}
            onChange={(e) => set({ area: e.target.value as AdminFilterState["area"] })}
            className="brutal-input cursor-pointer appearance-none bg-durbs-cyan pl-9 text-sm font-bold uppercase"
          >
            <option value="all">All areas</option>
            {DURBAN_AREAS.map((a) => (
              <option key={a} value={a}>
                {a} ({areaCount(a)})
              </option>
            ))}
          </select>
        </label>
      </div>

      <ScrollRow
        className="-mx-3 sm:mx-0"
        rowClassName="flex gap-2 overflow-x-auto px-3 pb-1.5 pt-0.5 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:p-0"
        fade="yellow"
        aria-label="Category filter"
      >
        <button
          type="button"
          aria-pressed={value.categories.size === 0}
          onClick={() => set({ categories: new Set() })}
          className="brutal-chip shrink-0 whitespace-nowrap"
        >
          All
        </button>
        {EVENT_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={value.categories.has(c)}
            onClick={() => toggleCategory(c)}
            className="brutal-chip shrink-0 whitespace-nowrap"
          >
            {categoryLabel(c)}
          </button>
        ))}
      </ScrollRow>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={value.featuredOnly}
          onClick={() => set({ featuredOnly: !value.featuredOnly })}
          className="brutal-chip inline-flex items-center gap-1.5"
        >
          <Star className={`h-3.5 w-3.5 ${value.featuredOnly ? "fill-durbs-yellow" : ""}`} /> Featured only
        </button>
        {isAdminFilterActive(value) && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_ADMIN_FILTERS)}
            className="brutal-btn bg-white !py-1 !text-xs"
          >
            <X className="h-3.5 w-3.5" strokeWidth={3} /> Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

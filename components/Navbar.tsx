"use client";

import Link from "next/link";
import { MapPin, Plus, Search } from "lucide-react";
import type { AreaFilter } from "@/types/event";
import { AREA_FILTERS } from "@/lib/areas";

interface NavbarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  area?: AreaFilter;
  onAreaChange?: (value: AreaFilter) => void;
  /** Hide search + area controls on secondary pages. */
  compact?: boolean;
}

export default function Navbar({
  search = "",
  onSearchChange,
  area = "All Areas",
  onAreaChange,
  compact = false,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-[1000] border-b-4 border-black bg-durbs-yellow">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <Link
          href="/"
          className="shrink-0 -rotate-1 border-3 border-black bg-white px-3 py-1 font-display text-xl tracking-tight shadow-brutal transition-transform hover:rotate-0 sm:text-2xl"
        >
          WhatsUp<span className="text-durbs-pink">Durbs</span> 🌊
        </Link>

        {!compact && (
          <div className="order-3 flex w-full gap-2 md:order-2 md:w-auto md:flex-1">
            <label className="relative flex-1">
              <span className="sr-only">Search events</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Search markets, gigs, pop-ups…"
                className="brutal-input pl-9"
              />
            </label>
            <label className="relative">
              <span className="sr-only">Filter by area</span>
              <MapPin
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2"
                aria-hidden
              />
              <select
                value={area}
                onChange={(e) => onAreaChange?.(e.target.value as AreaFilter)}
                className="brutal-input cursor-pointer appearance-none bg-durbs-cyan pl-8 pr-3 text-sm uppercase"
              >
                {AREA_FILTERS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="order-2 ml-auto flex items-center gap-2 md:order-3">
          <Link
            href="/admin"
            className="hidden text-xs font-black uppercase underline decoration-2 underline-offset-4 hover:text-durbs-purple sm:inline"
          >
            Admin
          </Link>
          <Link href="/submit" className="brutal-btn bg-durbs-pink text-white">
            Submit Event <Plus className="h-4 w-4" strokeWidth={3} />
          </Link>
        </div>
      </div>
    </header>
  );
}

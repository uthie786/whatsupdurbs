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
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:py-3">
        <Link
          href="/"
          className="flex min-w-0 shrink -rotate-1 items-center gap-1.5 whitespace-nowrap border-3 border-black bg-white px-2 py-0.5 font-display text-lg tracking-tight sm:px-3 sm:py-1 shadow-brutal transition-transform hover:rotate-0 sm:text-2xl"
        >
          <span>WhatsUp<span className="text-durbs-pink">Durbs</span></span>
          <img src="/logo.svg" alt="" aria-hidden className="h-6 w-auto sm:h-8" />
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
                className="brutal-input !py-1.5 pl-9 sm:!py-2"
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
                className="brutal-input cursor-pointer appearance-none bg-durbs-cyan !py-1.5 pl-8 pr-3 text-sm uppercase sm:!py-2"
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

        <div className="order-2 ml-auto flex shrink-0 items-center gap-2 md:order-3">
          <Link
            href="/admin"
            className="hidden text-xs font-black uppercase underline decoration-2 underline-offset-4 hover:text-durbs-purple sm:inline"
          >
            Admin
          </Link>
          <Link
            href="/submit"
            className="brutal-btn bg-durbs-pink !px-3 !py-1.5 !text-xs text-white sm:!px-4 sm:!py-2 sm:!text-sm"
          >
            Submit<span className="hidden sm:inline"> Event</span> <Plus className="h-4 w-4" strokeWidth={3} />
          </Link>
        </div>
      </div>
    </header>
  );
}

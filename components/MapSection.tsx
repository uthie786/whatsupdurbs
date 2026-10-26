"use client";

import dynamic from "next/dynamic";
import type { DurbsEvent } from "@/types/event";
import { CATEGORY_COLORS } from "@/lib/areas";
import { EVENT_CATEGORIES } from "@/types/event";

const InteractiveMap = dynamic(() => import("./InteractiveMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full animate-pulse items-center justify-center bg-durbs-cyan/30 font-display text-xl uppercase">
      Loading Durbs map…
    </div>
  ),
});

export default function MapSection({ events }: { events: DurbsEvent[] }) {
  return (
    <section id="map" className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-3xl uppercase sm:text-4xl">
          <span className="bg-durbs-cyan px-2">Map</span> the vibe
        </h2>
        <ul className="flex flex-wrap gap-2" aria-label="Map legend">
          {EVENT_CATEGORIES.map((c) => (
            <li
              key={c}
              className="brutal-badge bg-white"
            >
              <span
                className="inline-block h-3 w-3 border-2 border-black"
                style={{ backgroundColor: CATEGORY_COLORS[c] }}
              />
              {c}
            </li>
          ))}
        </ul>
      </div>
      <div className="relative z-0 h-[420px] overflow-hidden border-4 border-black shadow-brutal-lg sm:h-[520px]">
        <InteractiveMap events={events} />
      </div>
    </section>
  );
}

"use client";

import dynamic from "next/dynamic";
import type { DurbsEvent } from "@/types/event";
import type { LatLng } from "@/lib/geo";

// Leaflet needs `window`, so the map only ever renders in the browser.
const InteractiveMap = dynamic(() => import("./InteractiveMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full animate-pulse items-center justify-center bg-durbs-cyan/30 font-display uppercase">
      Loading map…
    </div>
  ),
});

export default function EventMap({ events, userLocation }: { events: DurbsEvent[]; userLocation?: LatLng | null }) {
  return <InteractiveMap events={events} userLocation={userLocation ?? null} />;
}

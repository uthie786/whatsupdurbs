"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, MapPin, Search } from "lucide-react";
import { AREA_COORDS, nearestArea } from "@/lib/areas";
import type { EventFormState } from "./EventForm";

const PinPickerMap = dynamic(() => import("./PinPickerMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-durbs-cyan/30" />,
});

interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
}

/** Exact pin set (not just the area's centre point). */
export function hasExactPin(form: Pick<EventFormState, "latitude" | "longitude" | "area">): boolean {
  const lat = Number(form.latitude);
  const lng = Number(form.longitude);
  if (!form.latitude || !form.longitude || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const [alat, alng] = AREA_COORDS[form.area];
  return Math.abs(lat - alat) > 1e-6 || Math.abs(lng - alng) > 1e-6;
}

// One lookup at a time across every form on the page (bulk import can show many).
let queue: Promise<unknown> = Promise.resolve();
function lookup(venue: string, address: string): Promise<GeocodeResult[]> {
  const run = queue.then(async () => {
    const qs = new URLSearchParams({ venue, address });
    const res = await fetch(`/api/geocode?${qs}`);
    const body = (await res.json().catch(() => ({}))) as { results?: GeocodeResult[]; error?: string };
    if (!res.ok) throw new Error(body.error || "Couldn't look up that address.");
    return body.results ?? [];
  });
  queue = run.catch(() => {});
  return run;
}

const short = (label: string) => label.split(",").slice(0, 3).join(",");

/** Map pin for an event: found from the venue/address, and adjustable by dragging or tapping. */
export default function LocationField({ form, onChange }: { form: EventFormState; onChange: (f: EventFormState) => void }) {
  const [status, setStatus] = useState<"idle" | "looking" | "found" | "none" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<GeocodeResult[]>([]);
  const [areaNote, setAreaNote] = useState<string | null>(null);

  // Latest form for async callbacks (the user may keep typing while a lookup runs).
  const formRef = useRef(form);
  formRef.current = form;
  /** The user placed the pin by hand: stop moving it automatically. */
  const manualRef = useRef(false);
  const query = `${form.venue_name.trim()}|${form.address.trim()}`;
  /** Don't re-look-up an event that already has an exact pin when the form opens. */
  const lastQueryRef = useRef(hasExactPin(form) ? query : "");

  const exact = hasExactPin(form);
  const position: [number, number] = exact ? [Number(form.latitude), Number(form.longitude)] : AREA_COORDS[form.area];

  function place(lat: number, lng: number, manual: boolean) {
    const area = nearestArea(lat, lng);
    const f = formRef.current;
    if (area !== f.area) setAreaNote(`Area set to ${area} from the pin.`);
    onChange({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6), area });
    if (manual) {
      manualRef.current = true;
      setStatus("idle");
      setMessage("Pin moved by hand.");
    }
  }

  async function find(auto = false) {
    const f = formRef.current;
    if (!f.venue_name.trim() && !f.address.trim()) {
      setStatus("none");
      setMessage("Add the venue or address first.");
      return;
    }
    lastQueryRef.current = `${f.venue_name.trim()}|${f.address.trim()}`;
    setStatus("looking");
    setMessage(null);
    try {
      const results = await lookup(f.venue_name.trim(), f.address.trim());
      if (auto && manualRef.current) return; // the user took over meanwhile
      setCandidates(results.slice(0, 4));
      if (results.length) {
        place(results[0].lat, results[0].lng, false);
        setStatus("found");
        setMessage(`Found: ${short(results[0].label)}`);
      } else {
        setStatus("none");
        setMessage("Couldn't find that address. Drag the pin onto the venue, or tap the map.");
      }
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Lookup failed. Drag the pin instead.");
    }
  }

  // Look the address up by itself a moment after the venue/address stop changing.
  useEffect(() => {
    if (manualRef.current || query === lastQueryRef.current) return;
    if (form.venue_name.trim().length < 3 && form.address.trim().length < 4) return;
    const timer = setTimeout(() => void find(true), 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `find` reads the latest form via ref
  }, [query]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-sm uppercase">Map pin</span>
        <button
          type="button"
          onClick={() => {
            manualRef.current = false;
            void find();
          }}
          disabled={status === "looking"}
          className="brutal-btn bg-durbs-cyan !py-1.5 !text-xs"
        >
          {status === "looking" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          Find address on map
        </button>
      </div>
      <div className="relative z-0 h-56 overflow-hidden border-3 border-black shadow-brutal">
        <PinPickerMap position={position} exact={exact} onPick={(lat, lng) => place(lat, lng, true)} />
      </div>
      <p className="flex items-start gap-1.5 text-xs font-semibold text-neutral-700" role="status">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {message && <span className={status === "none" || status === "error" ? "text-red-600" : ""}>{message} </span>}
          {exact
            ? "Drag the pin or tap the map to fine-tune it."
            : `Approximate: this is the centre of ${form.area}. Find the address or drag the pin onto the venue.`}
          {areaNote && <span className="font-bold"> {areaNote}</span>}
        </span>
      </p>
      {candidates.length > 1 && status === "found" && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-bold">Not the right place? Try:</span>
          {candidates.slice(1).map((c) => (
            <button
              key={`${c.lat},${c.lng}`}
              type="button"
              onClick={() => {
                place(c.lat, c.lng, false);
                setMessage(`Using: ${short(c.label)}`);
              }}
              className="border-2 border-black bg-white px-2 py-0.5 font-bold hover:bg-durbs-yellow"
            >
              {short(c.label)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

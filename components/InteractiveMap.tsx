"use client";

// Leaflet touches `window` on import, so this module must only ever be loaded
// through MapSection's `dynamic(..., { ssr: false })`.
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import Link from "next/link";
import { ArrowRight, Ticket } from "lucide-react";
import type { DurbsEvent } from "@/types/event";
import { CATEGORY_COLORS, DURBAN_CENTER } from "@/lib/areas";
import { distanceKm, eventPosition, type LatLng } from "@/lib/geo";
import { eventPath } from "@/lib/site";
import { formatEventDate } from "@/lib/filters";
import EventImage from "./EventImage";

interface InteractiveMapProps {
  events: DurbsEvent[];
  /** Visitor's location for "near me": shown as a marker and used to frame the map. */
  userLocation?: LatLng | null;
}

const userIcon = L.divIcon({
  className: "durbs-pin",
  html: `<div style="width:22px;height:22px;background:#00F0FF;border:3px solid #000;border-radius:9999px;box-shadow:0 0 0 6px rgba(0,240,255,0.35),3px 3px 0 0 #000;"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const iconCache = new Map<string, L.DivIcon>();

function pinIcon(color: string, featured: boolean): L.DivIcon {
  const key = `${color}-${featured}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const icon = L.divIcon({
    className: "durbs-pin",
    html: `<div style="width:30px;height:30px;background:${color};border:3px solid #000;box-shadow:3px 3px 0 0 #000;transform:rotate(45deg);border-radius:50% 50% 0 50%;display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(-45deg);font-size:13px;line-height:1;">${featured ? "★" : ""}</span>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
  iconCache.set(key, icon);
  return icon;
}

/** Spread events that share the same coordinates so every pin is clickable. */
function offsetPosition([lat, lng]: [number, number], indexInSpot: number): [number, number] {
  if (indexInSpot === 0) return [lat, lng];
  const angle = indexInSpot * 2.4;
  const radius = 0.0025 * Math.sqrt(indexInSpot);
  return [lat + Math.sin(angle) * radius, lng + Math.cos(angle) * radius];
}

/** Re-frame the map whenever the visible set of pins changes. */
function FitToPins({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const key = positions.map((p) => p.join(",")).join("|");
  useEffect(() => {
    if (!positions.length) {
      map.setView(DURBAN_CENTER, 11);
    } else if (positions.length === 1) {
      map.setView(positions[0], 13);
    } else {
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40], maxZoom: 13 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

export default function InteractiveMap({ events, userLocation = null }: InteractiveMapProps) {
  const seen = new Map<string, number>();
  const pins = events.map((event) => {
    const base = eventPosition(event);
    const spot = `${base[0].toFixed(3)},${base[1].toFixed(3)}`;
    const idx = seen.get(spot) ?? 0;
    seen.set(spot, idx + 1);
    return { event, position: offsetPosition(base, idx) };
  });

  return (
    <MapContainer
      center={DURBAN_CENTER}
      zoom={11}
      scrollWheelZoom={false}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToPins
        positions={
          userLocation
            ? // Frame the visitor plus the closest few events.
              [
                userLocation,
                ...pins
                  .map((p) => p.position)
                  .sort((a, b) => distanceKm(userLocation, a) - distanceKm(userLocation, b))
                  .slice(0, 5),
              ]
            : pins.map((p) => p.position)
        }
      />
      {userLocation && (
        <Marker position={userLocation} icon={userIcon} zIndexOffset={1000}>
          <Popup className="durbs-popup">
            <p className="!m-0 p-3 font-display text-sm uppercase">You are here</p>
          </Popup>
        </Marker>
      )}
      {pins.map(({ event, position }) => {
        return (
          <Marker
            key={event.id}
            position={position}
            icon={pinIcon(CATEGORY_COLORS[event.category], event.is_featured)}
          >
            <Popup className="durbs-popup">
              <div className="font-sans">
                <EventImage
                  src={event.image_url}
                  alt={event.title}
                  category={event.category}
                  className="h-24 w-full border-b-3 border-black"
                />
                <div className="space-y-1.5 p-3">
                  <span
                    className="brutal-badge"
                    style={{ backgroundColor: CATEGORY_COLORS[event.category] }}
                  >
                    {event.category}
                  </span>
                  <h3 className="font-display text-base leading-tight">{event.title}</h3>
                  <p className="!m-0 text-xs font-semibold">
                    📍 {event.venue_name}, {event.area}
                  </p>
                  <p className="!m-0 text-xs font-semibold">🗓 {formatEventDate(event)}</p>
                  {event.price_text && (
                    <p className="!m-0 text-xs font-black">💸 {event.price_text}</p>
                  )}
                  {event.ticket_url ? (
                    <a
                      href={event.ticket_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="brutal-btn mt-1 w-full bg-durbs-pink !py-1.5 !text-xs !text-white"
                    >
                      <Ticket className="h-3.5 w-3.5" /> Get Tickets
                    </a>
                  ) : (
                    <span className="brutal-badge mt-1 bg-durbs-cyan">No ticket needed</span>
                  )}
                  <Link
                    href={eventPath(event)}
                    className="brutal-btn mt-1 w-full bg-white !py-1.5 !text-xs !text-black"
                  >
                    Details <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

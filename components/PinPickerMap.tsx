"use client";

// Leaflet touches `window` on import: only load this through PinPicker's dynamic import.
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

const pin = L.divIcon({
  className: "durbs-pin",
  html: `<div style="width:34px;height:34px;background:#FF2E93;border:3px solid #000;box-shadow:3px 3px 0 0 #000;transform:rotate(45deg);border-radius:50% 50% 0 50%;"></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

function Recenter({ position, zoom }: { position: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position, Math.max(map.getZoom(), zoom));
    // Only when the pin is moved from outside (lookup / area change), not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position[0], position[1]]);
  return null;
}

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function PinPickerMap({
  position,
  exact,
  onPick,
}: {
  position: [number, number];
  /** False while the pin is just the area centre. */
  exact: boolean;
  onPick: (lat: number, lng: number) => void;
}) {
  const zoom = exact ? 15 : 13;
  return (
    <MapContainer center={position} zoom={zoom} scrollWheelZoom={false} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter position={position} zoom={zoom} />
      <ClickToPlace onPick={onPick} />
      <Marker
        position={position}
        icon={pin}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const { lat, lng } = (e.target as L.Marker).getLatLng();
            onPick(lat, lng);
          },
        }}
      />
    </MapContainer>
  );
}

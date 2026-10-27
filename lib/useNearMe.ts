"use client";

import { useCallback, useState } from "react";
import type { LatLng } from "@/lib/geo";

export type NearMeStatus = "off" | "locating" | "on" | "error";

const MESSAGES: Record<number, string> = {
  1: "Location access was blocked. Allow it in your browser settings to see events near you.",
  2: "Your location isn't available right now.",
  3: "Finding your location took too long. Try again.",
};

/** The visitor's position for "near me", requested only when they ask for it. */
export function useNearMe() {
  const [status, setStatus] = useState<NearMeStatus>("off");
  const [location, setLocation] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("error");
      setError("Your browser can't share its location.");
      return;
    }
    setStatus("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation([pos.coords.latitude, pos.coords.longitude]);
        setStatus("on");
      },
      (err) => {
        setStatus("error");
        setError(MESSAGES[err.code] ?? "Couldn't get your location.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, []);

  const clear = useCallback(() => {
    setStatus("off");
    setLocation(null);
    setError(null);
  }, []);

  const toggle = useCallback(() => (status === "on" ? clear() : request()), [status, clear, request]);

  return { status, location, error, request, clear, toggle };
}

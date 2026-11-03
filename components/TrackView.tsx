"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/stats";

/** Counts one anonymous view of an event page. Renders nothing. */
export default function TrackView({ eventId }: { eventId: string }) {
  useEffect(() => trackEvent(eventId, "view"), [eventId]);
  return null;
}

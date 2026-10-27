"use client";

import { Loader2, LocateFixed } from "lucide-react";
import type { NearMeStatus } from "@/lib/useNearMe";

export default function NearMeButton({
  status,
  onToggle,
  className = "!py-1.5 !text-xs",
}: {
  status: NearMeStatus;
  onToggle: () => void;
  /** Size overrides for `brutal-btn`. */
  className?: string;
}) {
  const on = status === "on";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      disabled={status === "locating"}
      className={`brutal-btn ${on ? "bg-black text-durbs-yellow" : "bg-white"} ${className}`}
    >
      {status === "locating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
      {on ? "Near me: on" : "Near me"}
    </button>
  );
}

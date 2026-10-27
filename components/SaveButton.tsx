"use client";

import { Heart } from "lucide-react";
import { useSavedEvents } from "@/lib/useSavedEvents";

interface SaveButtonProps {
  eventId: string;
  title: string;
  /** Show the "Save"/"Saved" label next to the heart. */
  withLabel?: boolean;
  className?: string;
}

export default function SaveButton({ eventId, title, withLabel = false, className = "" }: SaveButtonProps) {
  const { isSaved, toggle } = useSavedEvents();
  const saved = isSaved(eventId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(eventId);
      }}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved events` : `Save ${title}`}
      title={saved ? "Saved — tap to remove" : "Save for later"}
      className={`brutal-btn !px-2 !py-1.5 ${saved ? "bg-durbs-pink text-white" : "bg-white"} ${className}`}
    >
      <Heart className={`h-4 w-4 ${saved ? "fill-white" : ""}`} strokeWidth={2.5} />
      {withLabel && <span>{saved ? "Saved" : "Save"}</span>}
    </button>
  );
}

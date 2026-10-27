"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, ChevronDown } from "lucide-react";
import type { DurbsEvent } from "@/types/event";
import { googleCalendarUrl, icsFile, icsFilename } from "@/lib/calendar";

export default function AddToCalendar({ event, compact = false }: { event: DurbsEvent; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const downloadIcs = () => {
    const url = URL.createObjectURL(new Blob([icsFile(event)], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = icsFilename(event);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Add to calendar"
        className={`brutal-btn bg-durbs-cyan ${compact ? "!px-2 !py-1.5" : ""}`}
      >
        <CalendarPlus className="h-4 w-4" />
        {!compact && (
          <>
            Add to calendar <ChevronDown className="h-3.5 w-3.5" />
          </>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-[1100] mt-2 w-56 border-3 border-black bg-white shadow-brutal"
          onClick={(e) => e.stopPropagation()}
        >
          <a
            role="menuitem"
            href={googleCalendarUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block border-b-2 border-black px-3 py-2 text-sm font-bold hover:bg-durbs-yellow"
          >
            Google Calendar
          </a>
          <button
            type="button"
            role="menuitem"
            onClick={downloadIcs}
            className="block w-full px-3 py-2 text-left text-sm font-bold hover:bg-durbs-yellow"
          >
            Apple / Outlook (.ics)
          </button>
        </div>
      )}
    </div>
  );
}

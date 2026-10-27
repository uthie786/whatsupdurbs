"use client";

import { useEffect, useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import type { DurbsEvent } from "@/types/event";
import { formatEventDate } from "@/lib/filters";
import { eventUrl } from "@/lib/site";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91A9.85 9.85 0 0 0 12.04 2Zm5.8 14.13c-.25.69-1.44 1.33-1.98 1.38-.51.05-.99.24-3.32-.69-2.8-1.1-4.6-3.97-4.73-4.15-.14-.18-1.13-1.5-1.13-2.86 0-1.36.71-2.03.97-2.31.25-.28.55-.35.73-.35h.53c.17 0 .4-.06.62.48.25.6.85 2.06.92 2.21.08.15.13.32.03.51-.1.2-.15.32-.3.49-.15.18-.31.39-.45.52-.15.15-.3.31-.13.6.17.3.77 1.27 1.65 2.06 1.14 1.01 2.09 1.33 2.39 1.48.3.15.47.12.65-.07.18-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.28.1 1.75.83 2.05.98.3.15.5.22.57.35.07.12.07.72-.18 1.4Z" />
    </svg>
  );
}

export default function ShareButtons({ event }: { event: DurbsEvent }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const url = eventUrl(event);
  const text = `${event.title} — ${formatEventDate(event)} at ${event.venue_name}`;

  useEffect(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="brutal-btn bg-[#25D366] text-black"
      >
        <WhatsAppIcon /> WhatsApp
      </a>
      {canShare && (
        <button
          type="button"
          onClick={() => navigator.share({ title: event.title, text, url }).catch(() => {})}
          className="brutal-btn bg-white"
        >
          <Share2 className="h-4 w-4" /> Share
        </button>
      )}
      <button type="button" onClick={copy} className="brutal-btn bg-white">
        {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}

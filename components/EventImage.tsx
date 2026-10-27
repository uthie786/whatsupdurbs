"use client";

import { useState } from "react";
import type { EventCategory } from "@/types/event";
import { CATEGORY_COLORS } from "@/lib/areas";

interface EventImageProps {
  src: string | null;
  alt: string;
  category: EventCategory;
  className?: string;
}

/** Image with a bold colour-block fallback when the URL is missing or broken. */
export default function EventImage({ src, alt, category, className = "" }: EventImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center font-display text-4xl uppercase ${className}`}
        style={{
          backgroundColor: CATEGORY_COLORS[category],
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(0,0,0,0.08) 0 12px, transparent 12px 24px)",
        }}
      >
        <span className="border-3 border-black bg-white px-3 py-1 text-lg shadow-brutal">
          {category}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${/\bobject-(contain|cover|fill|none)\b/.test(className) ? "" : "object-cover"} ${className}`}
    />
  );
}

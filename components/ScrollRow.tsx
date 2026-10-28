"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ScrollRowProps {
  children: ReactNode;
  /** Classes for the outer box (margins). */
  className?: string;
  /** Classes for the scrolling row itself (flex, gap, padding, overflow). */
  rowClassName: string;
  /** Background behind the row, for the edge fades. */
  fade: "white" | "yellow";
  "aria-label": string;
}

const FADES = {
  white: { left: "from-white", right: "from-white" },
  yellow: { left: "from-durbs-yellow", right: "from-durbs-yellow" },
};

/**
 * A row of chips that scrolls sideways on phones, with a fade and an arrow
 * on whichever side has more to see. Nothing shows when the row fits (e.g. it wraps on desktop).
 */
export default function ScrollRow({ children, className = "", rowClassName, fade, ...rest }: ScrollRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  }, [update, children]);

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  };

  const arrow =
    "absolute top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border-3 border-black bg-white shadow-[2px_2px_0_0_#000] active:translate-x-0.5 active:shadow-none";

  return (
    <div className={`relative min-w-0 ${className}`}>
      <div ref={ref} onScroll={update} className={rowClassName} role="group" aria-label={rest["aria-label"]}>
        {children}
      </div>
      {canLeft && (
        <>
          <div
            className={`pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r ${FADES[fade].left} to-transparent`}
          />
          <button type="button" tabIndex={-1} aria-label="Scroll back" onClick={() => scrollBy(-1)} className={`${arrow} left-1`}>
            <ChevronLeft className="h-4 w-4" strokeWidth={3} />
          </button>
        </>
      )}
      {canRight && (
        <>
          <div
            className={`pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l ${FADES[fade].right} to-transparent`}
          />
          <button type="button" tabIndex={-1} aria-label="Scroll for more" onClick={() => scrollBy(1)} className={`${arrow} right-1`}>
            <ChevronRight className="h-4 w-4" strokeWidth={3} />
          </button>
        </>
      )}
    </div>
  );
}

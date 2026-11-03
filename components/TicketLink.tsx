"use client";

import type { ReactNode } from "react";
import { trackEvent } from "@/lib/stats";

/** External ticket link that counts an anonymous ticket click. */
export default function TicketLink({
  eventId,
  href,
  className,
  children,
}: {
  eventId: string;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={() => trackEvent(eventId, "ticket")}>
      {children}
    </a>
  );
}

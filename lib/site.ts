import type { DurbsEvent } from "@/types/event";

/** Public site address, used for share links, the sitemap and link previews. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://whatsupdurbs.vercel.app").replace(/\/+$/, "");

export function eventPath(event: Pick<DurbsEvent, "slug">): string {
  return `/events/${encodeURIComponent(event.slug)}`;
}

export function eventUrl(event: Pick<DurbsEvent, "slug">): string {
  return `${SITE_URL}${eventPath(event)}`;
}

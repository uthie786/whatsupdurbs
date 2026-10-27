import type { DurbsEvent } from "@/types/event";

/** Public site address, used for share links, the sitemap and link previews. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://whatsupdurbs.vercel.app").replace(/\/+$/, "");

export function eventPath(event: Pick<DurbsEvent, "slug">): string {
  return `/events/${encodeURIComponent(event.slug)}`;
}

export function eventUrl(event: Pick<DurbsEvent, "slug">): string {
  return `${SITE_URL}${eventPath(event)}`;
}

/** Contact address for privacy, data deletion and feature requests. */
export const CONTACT_EMAIL = "whatsupdurbz@gmail.com";

/** Current price for featuring an event. */
export const FEATURE_FEE = "R350";

/** Pre-filled email asking for an event to be featured. */
export function featureRequestMailto(event: { title: string; when?: string; venue?: string; url?: string }): string {
  const body = [
    "Hi WhatsUpDurbs,",
    "",
    `I'd like my event featured on WhatsUpDurbs (${FEATURE_FEE}). Please send me the payment details.`,
    "",
    `Event: ${event.title}`,
    event.when ? `Date: ${event.when}` : null,
    event.venue ? `Venue: ${event.venue}` : null,
    event.url ? `Link: ${event.url}` : null,
    "",
    "Organiser name: ",
    "Phone number: ",
  ]
    .filter((line) => line !== null)
    .join("\n");
  const subject = `Feature request: ${event.title}`;
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

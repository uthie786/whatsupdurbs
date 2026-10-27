import type { MetadataRoute } from "next";
import { listUpcomingEventSlugs } from "@/lib/eventsServer";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/submit`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/data-deletion`, changeFrequency: "yearly", priority: 0.2 },
  ];
  try {
    const events = await listUpcomingEventSlugs();
    for (const e of events) {
      pages.push({
        url: `${SITE_URL}/events/${encodeURIComponent(e.slug)}`,
        lastModified: e.updated,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  } catch (err) {
    // A sitemap without event pages is better than a broken one.
    console.error("Sitemap: couldn't list events", err);
  }
  return pages;
}

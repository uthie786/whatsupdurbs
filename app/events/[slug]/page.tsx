import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, Ticket } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EventImage from "@/components/EventImage";
import EventMap from "@/components/EventMap";
import SaveButton from "@/components/SaveButton";
import AddToCalendar from "@/components/AddToCalendar";
import ShareButtons from "@/components/ShareButtons";
import FeatureRequestButton from "@/components/FeatureRequestButton";
import { CATEGORY_BG } from "@/lib/areas";
import { formatEventDate } from "@/lib/filters";
import { getPublishedEventBySlug } from "@/lib/eventsServer";
import { eventPath, eventUrl, SITE_URL } from "@/lib/site";
import type { DurbsEvent } from "@/types/event";

// Re-check the database at most every 5 minutes per event page.
export const revalidate = 300;

interface PageProps {
  params: { slug: string };
}

async function loadEvent(slug: string): Promise<DurbsEvent | null> {
  return getPublishedEventBySlug(decodeURIComponent(slug));
}

function summary(event: DurbsEvent): string {
  const base = `${formatEventDate(event)} · ${event.venue_name}, ${event.area}${event.price_text ? ` · ${event.price_text}` : ""}`;
  return event.description ? `${base}. ${event.description}`.slice(0, 300) : base;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const event = await loadEvent(params.slug);
  if (!event) return { title: "Event not found | WhatsUpDurbs" };
  const description = summary(event);
  const images = event.image_url ? [{ url: event.image_url, alt: event.title }] : undefined;
  return {
    metadataBase: new URL(SITE_URL),
    title: `${event.title} | WhatsUpDurbs`,
    description,
    alternates: { canonical: eventPath(event) },
    openGraph: {
      type: "website",
      siteName: "WhatsUpDurbs",
      title: event.title,
      description,
      url: eventUrl(event),
      images,
    },
    twitter: {
      card: event.image_url ? "summary_large_image" : "summary",
      title: event.title,
      description,
      images: event.image_url ? [event.image_url] : undefined,
    },
  };
}

/** schema.org Event, so search engines can show it in event listings. */
function eventJsonLd(event: DurbsEvent) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description || undefined,
    startDate: event.start_date,
    endDate: event.end_date || undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    image: event.image_url ? [event.image_url] : undefined,
    url: eventUrl(event),
    location: {
      "@type": "Place",
      name: event.venue_name,
      address: {
        "@type": "PostalAddress",
        streetAddress: event.address || undefined,
        addressLocality: "Durban",
        addressRegion: "KwaZulu-Natal",
        addressCountry: "ZA",
      },
      geo: { "@type": "GeoCoordinates", latitude: event.latitude, longitude: event.longitude },
    },
    offers: event.ticket_url
      ? { "@type": "Offer", url: event.ticket_url, priceCurrency: "ZAR", availability: "https://schema.org/InStock" }
      : undefined,
  };
}

export default async function EventPage({ params }: PageProps) {
  const event = await loadEvent(params.slug);
  if (!event) notFound();

  const ended = new Date(event.end_date ?? event.start_date).getTime() < Date.now() - 6 * 60 * 60 * 1000;
  // Escape "<" so event text can't close the script tag.
  const jsonLd = JSON.stringify(eventJsonLd(event)).replace(/</g, "\\u003c");

  return (
    <>
      <Navbar compact />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <Link href="/#events" className="inline-flex items-center gap-1 text-sm font-black uppercase underline decoration-2 underline-offset-4">
          <ArrowLeft className="h-4 w-4" /> All events
        </Link>

        <article className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="space-y-3">
            <EventImage
              src={event.image_url}
              alt={`${event.title} poster`}
              category={event.category}
              className="h-auto max-h-[640px] min-h-[280px] w-full border-4 border-black bg-white object-contain shadow-brutal-lg"
            />
          </div>

          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <span className={`brutal-badge ${CATEGORY_BG[event.category]}`}>{event.category}</span>
              <span className="brutal-badge bg-white">{event.area}</span>
              {event.is_featured && <span className="brutal-badge bg-durbs-yellow">★ Featured</span>}
              {ended && <span className="brutal-badge bg-black text-white">This event has ended</span>}
            </div>
            <h1 className="font-display text-4xl uppercase leading-none sm:text-5xl">{event.title}</h1>

            <ul className="space-y-2 text-base font-bold">
              <li className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 h-5 w-5 shrink-0" /> {formatEventDate(event)}
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  {event.venue_name}
                  {event.address && <span className="block text-sm font-semibold text-neutral-700">{event.address}</span>}
                </span>
              </li>
              {event.price_text && (
                <li>
                  <span className="border-2 border-black bg-durbs-cyan px-2 py-0.5">{event.price_text}</span>
                </li>
              )}
            </ul>

            <div className="flex flex-wrap items-center gap-2">
              {event.ticket_url && (
                <a
                  href={event.ticket_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="brutal-btn bg-durbs-pink text-base text-white"
                >
                  <Ticket className="h-4 w-4" /> Get Tickets
                </a>
              )}
              <AddToCalendar event={event} />
              <SaveButton eventId={event.id} title={event.title} withLabel />
            </div>

            {event.description && (
              <p className="whitespace-pre-line text-lg font-medium text-neutral-800">{event.description}</p>
            )}

            <div className="space-y-2 border-t-3 border-black pt-4">
              <p className="font-display text-sm uppercase">Tell your crew</p>
              <ShareButtons event={event} />
            </div>

            {!event.is_featured && !ended && (
              <div className="space-y-2 border-3 border-dashed border-black bg-white p-4">
                <p className="font-display text-sm uppercase">Organiser? Get this event featured</p>
                <FeatureRequestButton
                  title={event.title}
                  when={formatEventDate(event)}
                  venue={event.venue_name}
                  url={eventUrl(event)}
                />
              </div>
            )}
          </div>
        </article>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl uppercase">Where</h2>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="brutal-btn bg-white !py-1.5 !text-xs"
            >
              <MapPin className="h-3.5 w-3.5" /> Directions
            </a>
          </div>
          <div className="relative z-0 h-[340px] overflow-hidden border-4 border-black shadow-brutal-lg">
            <EventMap events={[event]} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

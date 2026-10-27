export const EVENT_CATEGORIES = [
  "Markets",
  "Concerts",
  "Popups",
  "Nightlife",
  "Festive",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const DURBAN_AREAS = [
  "Umhlanga",
  "Morningside",
  "Durban North",
  "Ballito",
  "Central Beachfront",
  "Point Waterfront",
] as const;

export type DurbanArea = (typeof DURBAN_AREAS)[number];

export interface DurbsEvent {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: EventCategory;
  venue_name: string;
  address: string;
  area: DurbanArea;
  latitude: number;
  longitude: number;
  /** ISO 8601 timestamp */
  start_date: string;
  /** ISO 8601 timestamp, optional for single-session events */
  end_date: string | null;
  image_url: string | null;
  ticket_url: string | null;
  price_text: string | null;
  is_featured: boolean;
  is_approved: boolean;
  /** "manual" for submissions/admin entries, "quicket" for synced events. */
  source?: string;
  /** ID in the source system, e.g. the Quicket event ID. */
  external_id?: string | null;
  /** Set when an admin denies a submission; the row is purged 24h later. */
  denied_at?: string | null;
  /** Link to where the event was found, e.g. the Instagram post. */
  source_url?: string | null;
  /** Set when an admin edits the event; the Quicket sync then leaves it alone. */
  edited_at?: string | null;
  created_at?: string;
}

/** Shape submitted by organisers; moderation flags are set server-side. */
export type NewEventInput = Omit<
  DurbsEvent,
  "id" | "is_featured" | "is_approved" | "created_at" | "source" | "external_id" | "denied_at" | "edited_at" | "source_url"
>;

export type CategoryFilter = "All" | EventCategory;
export type DateFilter = "All" | "Today" | "This Weekend" | "Festive Season";
export type AreaFilter =
  | "All Areas"
  | "Umhlanga"
  | "Morningside"
  | "Durban North"
  | "Ballito"
  | "Beachfront";

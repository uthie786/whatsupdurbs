import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { addDays, setHours, setMinutes, startOfDay } from "date-fns";
import type { DurbsEvent, NewEventInput } from "@/types/event";
import { errorMessage } from "@/lib/errors";
import { AREA_COORDS } from "@/lib/areas";
import { weekendWindow } from "@/lib/filters";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

export const EVENTS_TABLE = "events";

/* ------------------------------------------------------------------ */
/* Mock data — used when Supabase env vars are missing (demo/preview). */
/* Dates are generated relative to "now" so date filters always match. */
/* ------------------------------------------------------------------ */

function at(base: Date, hour: number, minute = 0): string {
  return setMinutes(setHours(base, hour), minute).toISOString();
}

function buildMockEvents(): DurbsEvent[] {
  const now = new Date();
  const { from: friday } = weekendWindow(now);
  const saturday = addDays(friday, 1);
  const sunday = addDays(friday, 2);
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const dec = (day: number) => new Date(year, 11, day);

  const base = (
    partial: Omit<DurbsEvent, "latitude" | "longitude" | "is_approved"> &
      Partial<Pick<DurbsEvent, "is_approved">>,
  ): DurbsEvent => {
    const [lat, lng] = AREA_COORDS[partial.area];
    return { latitude: lat, longitude: lng, is_approved: true, ...partial };
  };

  return [
    base({
      id: "mock-1",
      title: "I Heart Market",
      slug: "i-heart-market",
      description:
        "Durban's OG designer market on the lawns of Moses Mabhida. Local makers, vintage threads, craft coffee and bunny chow sliders.",
      category: "Markets",
      venue_name: "Moses Mabhida Stadium",
      address: "44 Isaiah Ntshangase Rd, Stamford Hill",
      area: "Central Beachfront",
      start_date: at(saturday, 9),
      end_date: at(saturday, 14),
      image_url:
        "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1200&q=80",
      ticket_url: "https://www.iheartmarket.com",
      price_text: "Free entry",
      is_featured: true,
    }),
    base({
      id: "mock-2",
      title: "Gqom Sundowner Sessions",
      slug: "gqom-sundowner-sessions",
      description:
        "Rooftop gqom and amapiano sundowner with Durban's hottest selectors. Golden hour views over the harbour.",
      category: "Nightlife",
      venue_name: "The Wavehouse Rooftop",
      address: "Point Waterfront Promenade",
      area: "Point Waterfront",
      start_date: at(now, 17),
      end_date: at(now, 23, 30),
      image_url:
        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&q=80",
      ticket_url: "https://www.quicket.co.za",
      price_text: "R150",
      is_featured: true,
    }),
    base({
      id: "mock-3",
      title: "Umhlanga Live on the Lawn",
      slug: "umhlanga-live-on-the-lawn",
      description:
        "Open-air concert series featuring SA indie & afro-soul acts. Bring a picnic blanket, food trucks on site.",
      category: "Concerts",
      venue_name: "Umhlanga Promenade Lawns",
      address: "Lagoon Drive, Umhlanga Rocks",
      area: "Umhlanga",
      start_date: at(saturday, 15),
      end_date: at(saturday, 21),
      image_url:
        "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&q=80",
      ticket_url: "https://www.webtickets.co.za",
      price_text: "From R250",
      is_featured: true,
    }),
    base({
      id: "mock-4",
      title: "Florida Road Sneaker Pop-Up",
      slug: "florida-road-sneaker-popup",
      description:
        "One-day-only drop of limited sneakers and streetwear from local Durban labels. DJ set and free kicks cleaning.",
      category: "Popups",
      venue_name: "Florida Road Precinct",
      address: "Florida Rd, Morningside",
      area: "Morningside",
      start_date: at(now, 10),
      end_date: at(now, 18),
      image_url:
        "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=1200&q=80",
      ticket_url: null,
      price_text: "Free",
      is_featured: false,
    }),
    base({
      id: "mock-5",
      title: "Durban North Night Market",
      slug: "durban-north-night-market",
      description:
        "Street food, craft beer and fairy lights. 40+ stalls, live acoustic music and kids' corner.",
      category: "Markets",
      venue_name: "Kensington Square",
      address: "Kensington Dr, Durban North",
      area: "Durban North",
      start_date: at(friday, 17),
      end_date: at(friday, 22),
      image_url:
        "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=1200&q=80",
      ticket_url: null,
      price_text: "R20 entry",
      is_featured: false,
    }),
    base({
      id: "mock-6",
      title: "Ballito Beach Club Takeover",
      slug: "ballito-beach-club-takeover",
      description:
        "All-day deep house on the sand. Cabanas, cocktails and the North Coast's best sunset.",
      category: "Nightlife",
      venue_name: "Salt Rock Beach Club",
      address: "Basil Hulett Dr, Ballito",
      area: "Ballito",
      start_date: at(sunday, 12),
      end_date: at(sunday, 22),
      image_url:
        "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&q=80",
      ticket_url: "https://www.howler.co.za",
      price_text: "From R200",
      is_featured: false,
    }),
    base({
      id: "mock-7",
      title: "Festival of Lights on the Golden Mile",
      slug: "festival-of-lights-golden-mile",
      description:
        "The beachfront lights up for the festive season — lantern parade, fireworks and carols on the sand.",
      category: "Festive",
      venue_name: "North Beach Amphitheatre",
      address: "OR Tambo Parade, North Beach",
      area: "Central Beachfront",
      start_date: at(dec(16), 18),
      end_date: at(dec(16), 22),
      image_url:
        "https://images.unsplash.com/photo-1482517967863-00e15c9b44be?w=1200&q=80",
      ticket_url: null,
      price_text: "Free",
      is_featured: true,
    }),
    base({
      id: "mock-8",
      title: "Gateway Christmas Makers Fair",
      slug: "gateway-christmas-makers-fair",
      description:
        "Gift shopping sorted: handmade décor, artisanal treats and Santa's grotto for the little ones.",
      category: "Festive",
      venue_name: "Gateway Theatre of Shopping",
      address: "1 Palm Blvd, Umhlanga Ridge",
      area: "Umhlanga",
      start_date: at(dec(5), 9),
      end_date: at(dec(24), 18),
      image_url:
        "https://images.unsplash.com/photo-1512389142860-9c449e58a543?w=1200&q=80",
      ticket_url: null,
      price_text: "Free entry",
      is_featured: false,
    }),
    base({
      id: "mock-9",
      title: "uShaka Summer Jam",
      slug: "ushaka-summer-jam",
      description:
        "Durban's biggest summer concert at the waterfront — headline SA hip-hop with surprise guests.",
      category: "Concerts",
      venue_name: "uShaka Marine World",
      address: "1 King Shaka Ave, Point",
      area: "Point Waterfront",
      start_date: at(dec(27), 14),
      end_date: at(dec(27), 23),
      image_url:
        "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&q=80",
      ticket_url: "https://www.computicket.com",
      price_text: "From R350",
      is_featured: false,
    }),
    base({
      id: "mock-10",
      title: "Morningside Plant & Vinyl Swap",
      slug: "morningside-plant-vinyl-swap",
      description:
        "Swap your cuttings and crates. Coffee cart, record listening booth and a pop-up plant doctor.",
      category: "Popups",
      venue_name: "Musgrave Community Hall",
      address: "Musgrave Rd, Morningside",
      area: "Morningside",
      start_date: at(addDays(now, 9), 10),
      end_date: at(addDays(now, 9), 15),
      image_url:
        "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?w=1200&q=80",
      ticket_url: null,
      price_text: "Free",
      is_featured: false,
    }),
    base({
      id: "mock-11",
      title: "Underground Techno Warehouse",
      slug: "underground-techno-warehouse",
      description:
        "Pending moderation — a secret-location warehouse rave in the Point precinct.",
      category: "Nightlife",
      venue_name: "TBA Warehouse",
      address: "Point Precinct",
      area: "Point Waterfront",
      start_date: at(addDays(now, 12), 22),
      end_date: at(addDays(now, 13), 4),
      image_url:
        "https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=1200&q=80",
      ticket_url: "https://www.quicket.co.za",
      price_text: "R180",
      is_featured: false,
      is_approved: false,
    }),
  ];
}

/** In-memory store for demo mode so submit → admin works within a session. */
let mockStore: DurbsEvent[] | null = null;
function getMockStore(): DurbsEvent[] {
  if (!mockStore) mockStore = buildMockEvents();
  return mockStore;
}

export const mockEvents: DurbsEvent[] = buildMockEvents();

const byStartDate = (a: DurbsEvent, b: DurbsEvent) =>
  a.start_date.localeCompare(b.start_date);

/* ------------------------------ Queries ------------------------------ */

/** Events that haven't finished yet (single-day events stay up all day). */
function isUpcoming(e: DurbsEvent, now = new Date()): boolean {
  if (e.end_date) return new Date(e.end_date) >= now;
  return new Date(e.start_date) >= startOfDay(now);
}

export async function fetchApprovedEvents(): Promise<DurbsEvent[]> {
  if (!supabase) {
    return getMockStore()
      .filter((e) => e.is_approved && isUpcoming(e))
      .sort(byStartDate);
  }
  const now = new Date().toISOString();
  const today = startOfDay(new Date()).toISOString();
  const { data, error } = await supabase
    .from(EVENTS_TABLE)
    .select("*")
    .eq("is_approved", true)
    .or(`end_date.gte.${now},and(end_date.is.null,start_date.gte.${today})`)
    .order("start_date", { ascending: true });
  if (error) throw new Error(errorMessage(error));
  return (data ?? []) as DurbsEvent[];
}

/** Denied submissions are deleted this long after being denied. */
export const DENIED_RETENTION_MS = 24 * 60 * 60 * 1000;

export async function fetchAllEventsForAdmin(): Promise<DurbsEvent[]> {
  if (!supabase) {
    // Demo mode stands in for the database purge job.
    const cutoff = Date.now() - DENIED_RETENTION_MS;
    mockStore = getMockStore().filter(
      (e) => !e.denied_at || new Date(e.denied_at).getTime() > cutoff,
    );
    return [...mockStore].sort(byStartDate);
  }
  const { data, error } = await supabase
    .from(EVENTS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(errorMessage(error));
  return (data ?? []) as DurbsEvent[];
}

export async function submitEvent(input: NewEventInput): Promise<void> {
  const row = { ...input, is_approved: false, is_featured: false };
  if (!supabase) {
    getMockStore().push({
      ...row,
      id: `mock-${Date.now()}`,
      created_at: new Date().toISOString(),
    });
    return;
  }
  const { error } = await supabase.from(EVENTS_TABLE).insert(row);
  if (error) throw new Error(errorMessage(error));
}

export type EventFlagsPatch = Partial<
  Pick<DurbsEvent, "is_approved" | "is_featured" | "denied_at">
>;

export async function updateEventFlags(
  id: string,
  patch: EventFlagsPatch,
): Promise<void> {
  if (!supabase) {
    const event = getMockStore().find((e) => e.id === id);
    if (event) Object.assign(event, patch);
    return;
  }
  const { error } = await supabase.from(EVENTS_TABLE).update(patch).eq("id", id);
  if (error) throw new Error(errorMessage(error));
}

/* --------------------------- Poster imports --------------------------- */

export const POSTERS_BUCKET = "posters";

/** Upload a poster image and return its public URL (an object URL in demo mode). */
export async function uploadPoster(blob: Blob): Promise<string> {
  if (!supabase) return URL.createObjectURL(blob);
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(POSTERS_BUCKET)
    .upload(path, blob, { contentType: blob.type || "image/jpeg", cacheControl: "31536000" });
  if (error) throw new Error(`Uploading the poster failed: ${errorMessage(error)}`);
  return supabase.storage.from(POSTERS_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Admin-created event, published straight away. */
export async function publishEvent(input: NewEventInput, source = "poster"): Promise<void> {
  const row = { ...input, is_approved: true, is_featured: false, source };
  if (!supabase) {
    getMockStore().push({ ...row, id: `mock-${Date.now()}`, created_at: new Date().toISOString() });
    return;
  }
  const { error } = await supabase.from(EVENTS_TABLE).insert(row);
  if (error) throw new Error(errorMessage(error));
}

/** Fields an admin can change when editing an event (slug stays so links keep working). */
export type EventDetailsPatch = Partial<
  Omit<DurbsEvent, "id" | "slug" | "is_approved" | "is_featured" | "denied_at" | "created_at" | "source" | "external_id">
>;

/** Save an admin's edits. Marks the event as edited so the Quicket sync won't overwrite it. */
export async function updateEventDetails(id: string, patch: EventDetailsPatch): Promise<void> {
  const row = { ...patch, edited_at: new Date().toISOString() };
  if (!supabase) {
    const event = getMockStore().find((e) => e.id === id);
    if (event) Object.assign(event, row);
    return;
  }
  const { error } = await supabase.from(EVENTS_TABLE).update(row).eq("id", id);
  if (error) throw new Error(errorMessage(error));
}

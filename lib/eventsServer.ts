// Server-side reads for pages rendered on the server (event pages, sitemap).
import { createClient } from "@supabase/supabase-js";
import type { DurbsEvent } from "@/types/event";
import { EVENTS_TABLE, isSupabaseConfigured, mockEvents } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";

function anonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** One published event by slug, or null. */
export async function getPublishedEventBySlug(slug: string): Promise<DurbsEvent | null> {
  if (!isSupabaseConfigured) {
    return mockEvents.find((e) => e.slug === slug && e.is_approved) ?? null;
  }
  const { data, error } = await anonClient()
    .from(EVENTS_TABLE)
    .select("*")
    .eq("slug", slug)
    .eq("is_approved", true)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(errorMessage(error));
  return (data as DurbsEvent | null) ?? null;
}

/** Slugs and update times of published events that haven't ended, for the sitemap. */
export async function listUpcomingEventSlugs(): Promise<{ slug: string; updated: string }[]> {
  const now = new Date().toISOString();
  if (!isSupabaseConfigured) {
    return mockEvents
      .filter((e) => e.is_approved && (e.end_date ?? e.start_date) >= now)
      .map((e) => ({ slug: e.slug, updated: e.created_at ?? now }));
  }
  const { data, error } = await anonClient()
    .from(EVENTS_TABLE)
    .select("slug, created_at, edited_at, start_date, end_date")
    .eq("is_approved", true)
    .or(`end_date.gte.${now},and(end_date.is.null,start_date.gte.${now})`)
    .limit(5000);
  if (error) throw new Error(errorMessage(error));
  return (data ?? []).map((r) => ({
    slug: r.slug as string,
    updated: ((r.edited_at as string | null) ?? (r.created_at as string | null) ?? now) as string,
  }));
}

# WhatsUpDurbs 🌊

A loud, Neo-Brutalist hub for Durban events, markets, pop-ups, nightlife and festive season happenings.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · lucide-react · Leaflet / react-leaflet (OpenStreetMap) · Supabase · date-fns

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without Supabase credentials the site runs in **demo mode** with built-in sample events (`lib/supabase.ts`), and submissions/moderation work in memory for the browser session.

## Connecting Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor. It creates the `events` table and row-level security:
   - anyone can read approved events,
   - anyone can submit events, but only with `is_approved = false` and `is_featured = false`,
   - signed-in users can read everything and approve/feature events.
3. Create a moderator user under **Authentication → Users** (email + password). The `/admin` page asks them to sign in.
   > The update policy allows *any* authenticated user. If you enable public sign-ups, restrict it (e.g. a `moderators` table checked in the policy).
4. Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## Updating an existing database

If the site shows an error like `Could not find the 'source' column of 'events'`, your table predates newer features. This block is safe to run any number of times:

```sql
alter table public.events
  add column if not exists source text not null default 'manual',
  add column if not exists external_id text unique,
  add column if not exists denied_at timestamptz;

drop policy if exists "Anyone can submit an event" on public.events;
drop policy if exists "Public submit pending events" on public.events;
create policy "Public submit pending events"
  on public.events for insert
  with check (is_approved = false and is_featured = false
              and source = 'manual' and external_id is null
              and denied_at is null);

notify pgrst, 'reload schema';
```

## Quicket sync

Public Quicket events within ~45 km of Durban are imported into `events` (published, with "Get Tickets" linking to the Quicket page).

**How it works:** Quicket's "list events" API times out on its own server for anything bigger than about two hours of changes, and the API key has a low request quota. So the sync is *incremental*: every hour it asks for events modified since the last successful run (with a 10-minute overlap) and stores the cursor in `sync_state`. If it falls more than 2 hours behind, it skips ahead and notes the gap. A full historical import isn't possible through Quicket's API, so events that already existed before the first sync appear once their organiser edits them. Add those with **Add event from poster** instead.

Setup:
- Set these **server-only** env vars in Vercel (no `NEXT_PUBLIC_` prefix): `QUICKET_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.
- Run the migration blocks in `supabase/schema.sql`: the `source`/`external_id` columns, the `sync_state` table, and the hourly `quicket-sync` pg_cron job (fill in your site URL and `CRON_SECRET`; needs the `pg_cron` and `pg_net` extensions).
- A daily Vercel Cron (`vercel.json`) calls the same endpoint as a backup.
- `GET /api/sync/quicket?dryRun=1` (with `Authorization: Bearer $CRON_SECRET`) fetches and maps without saving.
- Re-syncs update an event's details but never override your approve / feature / unpublish choices.
- Events are matched to the nearest of the six areas for filtering; their map pins use the real venue location.

Past events are hidden from the public site automatically (nothing is deleted).

## Add events from posters (free AI)

On `/admin`, **Add event from poster** takes one poster image (drop, paste or choose). Google's Gemini reads the title, dates, venue, area, price and ticket link into a form; you check the highlighted fields and click **Publish**. The poster (resized to 1600px) is stored in the public Supabase Storage bucket `posters` and becomes the event image.

Setup:
- Create a free API key at [aistudio.google.com](https://aistudio.google.com) and add it in Vercel as `GEMINI_API_KEY` (server-only). Optionally set `GEMINI_MODEL` (default `gemini-flash-latest`) and `GEMINI_FALLBACK_MODEL` (default `gemini-flash-lite-latest`, used when the main model is overloaded or out of free quota).
- Run the "Poster imports" block at the end of `supabase/schema.sql` (storage bucket, upload policies, admin insert policy).
- The free tier has request limits and Google may use free-tier inputs to improve its products. If reading fails, the form still opens with the poster attached so you can type the details in.

## Pages

| Route     | What it does |
|-----------|--------------|
| `/`       | Hero, featured carousel, interactive Durban map, filters (category / date / area / search) and event grid |
| `/submit` | Organiser submission form → inserted with `is_approved: false` |
| `/admin`  | Moderation queue: 1-click approve, deny, feature/unfeature, unpublish; add events from posters; Quicket sync |

### Denying submissions

**Deny** on a pending submission moves it to the *Denied* tab, where it can be restored. Denied rows are deleted 24 hours later by the `purge-denied-events` pg_cron job in `supabase/schema.sql` (and, as a backup, by each Quicket sync).

## Project layout

```
app/              layout, home, submit, admin
components/       Navbar, HomeClient, FeaturedCarousel, MapSection (dynamic, ssr:false) → InteractiveMap,
                  FilterBar, EventGrid, EventCard, EventImage
lib/              supabase client + mock data, area coordinates, filter/date helpers
types/event.ts    DurbsEvent types
supabase/         schema.sql
```

Leaflet requires `window`, so `InteractiveMap` is only ever loaded through `next/dynamic` with `{ ssr: false }` inside the client component `MapSection`.

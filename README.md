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

alter table public.events add column if not exists edited_at timestamptz;

create table if not exists public.api_usage (
  id bigserial primary key, ip text not null, kind text not null,
  created_at timestamptz not null default now());
create index if not exists api_usage_lookup on public.api_usage (kind, ip, created_at);
alter table public.api_usage enable row level security;

alter table public.events drop constraint if exists events_category_check;
alter table public.events add constraint events_category_check check (category in
  ('Markets','Concerts','Nightlife','Festive','Popups','Fitness','Outdoors','Cars',
   'Food','Theatre','Arts','Family','Social','Workshops'));

-- Allowed areas (keep in sync with DURBAN_AREAS / AREA_COORDS in the app).
alter table public.events drop constraint if exists events_area_check;
alter table public.events add constraint events_area_check check (area in
  ('Umhlanga','Morningside','Durban North','Ballito',
   'Central Beachfront','Point Waterfront',
   'CBD & Berea','Westville','Pinetown','Upper Highway'));

-- Re-label Quicket events by venue location: nearest area centre, as the sync does.
-- (Manual and poster events store their chosen area's centre, so they're already right.)
update public.events e set area = (
  select c.area from (values
    ('Umhlanga', -29.7262, 31.0849), ('Morningside', -29.8261, 31.0164),
    ('Durban North', -29.7896, 31.0322), ('Ballito', -29.5389, 31.2144),
    ('Central Beachfront', -29.8579, 31.0384), ('Point Waterfront', -29.8686, 31.0464),
    ('CBD & Berea', -29.855, 31.016), ('Westville', -29.838, 30.929),
    ('Pinetown', -29.818, 30.865), ('Upper Highway', -29.78, 30.79)
  ) as c(area, lat, lng)
  order by power(c.lat - e.latitude, 2) + power((c.lng - e.longitude) * cos(radians(-29.85)), 2)
  limit 1)
where e.source = 'quicket';

notify pgrst, 'reload schema';
```

## Visitor features

- **Categories:** Markets, Concerts, Nightlife, Festive, Popups, Fitness, Outdoors, Cars, Food, Theatre, Arts, Family, Social, Workshops. They're defined in `types/event.ts` with colours, emoji and descriptions in `lib/areas.ts`; the descriptions also guide the poster AI. Adding one also needs the `events_category_check` constraint updated.

- **Event pages** at `/events/<slug>`: poster, details, map with directions, Get Tickets, WhatsApp / native share / copy link, add to calendar and save. Link previews (WhatsApp, Facebook, X) show the poster, and schema.org `Event` data helps Google list events. Pages refresh from the database at most every 5 minutes.
- **Story image**: on an event page, **Story image** makes a 1080×1920 Instagram-story PNG (logo, poster, title, when/where/price) in yellow, pink or cyan, served by `/events/<slug>/story?theme=…` (`lib/storyImage.tsx`, rendered with `next/og`). Phones can share it straight to Instagram; otherwise it downloads. Fonts are in `assets/fonts` (Archivo Black and Space Grotesk, SIL Open Font License). Posters must be PNG or JPEG to appear; otherwise the category block is shown.
- **Add to calendar**: Google Calendar link or an `.ics` file for Apple Calendar / Outlook (all-day when the time is TBC).
- **Saved events**: the ❤️ button stores events in the visitor's browser (no account); the **Saved** filter shows only those.
- **Near me**: asks for the visitor's location (only when they tap it), sorts events by distance and shows them on the map.
- `sitemap.xml` and `robots.txt` are generated. Set `NEXT_PUBLIC_SITE_URL` if the site isn't at `https://whatsupdurbs.vercel.app`.
- All dates are shown in Durban time (SAST), whatever the visitor's or server's timezone.

## Quicket sync

Public Quicket events within ~45 km of Durban are imported into `events` (published, with "Get Tickets" linking to the Quicket page).

**How it works:** Quicket's "list events" API times out on its own server for anything bigger than about two hours of changes, and the API key has a low request quota. So the sync is *incremental*: every hour it asks for events modified since the last successful run (with a 10-minute overlap) and stores the cursor in `sync_state`. If it falls more than 2 hours behind, it skips ahead and notes the gap. A full historical import isn't possible through Quicket's API, so events that already existed before the first sync appear once their organiser edits them. Add those with **Add event from poster** instead.

Setup:
- Set these **server-only** env vars in Vercel (no `NEXT_PUBLIC_` prefix): `QUICKET_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.
- Run the migration blocks in `supabase/schema.sql`: the `source`/`external_id` columns, the `sync_state` table, and the hourly `quicket-sync` pg_cron job (fill in your site URL and `CRON_SECRET`; needs the `pg_cron` and `pg_net` extensions).
- A daily Vercel Cron (`vercel.json`) calls the same endpoint as a backup.
- `GET /api/sync/quicket?dryRun=1` (with `Authorization: Bearer $CRON_SECRET`) fetches and maps without saving.
- Re-syncs update an event's details but never override your approve / feature / unpublish choices.
- Events are matched to the nearest area centre (`AREA_COORDS` in `lib/areas.ts`) for filtering; their map pins use the real venue location.

Past events are hidden from the public site automatically (nothing is deleted).

## Add events from posters (free AI)

On `/admin`, **Add event from poster** takes one poster image (drop, paste or choose). Google's Gemini reads the title, dates, venue, area, price and ticket link into a form; you check the highlighted fields and click **Publish**. The poster (resized to 1600px) is stored in the public Supabase Storage bucket `posters` and becomes the event image.

Setup:
- Create a free API key at [aistudio.google.com](https://aistudio.google.com) and add it in Vercel as `GEMINI_API_KEY` (server-only). Optionally set `GEMINI_MODEL` (default `gemini-flash-latest`) and `GEMINI_FALLBACK_MODEL` (default `gemini-flash-lite-latest`, used when the main model is overloaded or out of free quota).
- Run the "Poster imports" block at the end of `supabase/schema.sql` (storage bucket, upload policies, admin insert policy).
- The free tier has request limits and Google may use free-tier inputs to improve its products. If reading fails, the form still opens with the poster attached so you can type the details in.

### Organiser posters on /submit

Organisers can upload a poster on `/submit`; Gemini pre-fills the form and the poster becomes the event image (stored under `posters/submissions/`). To protect the free Gemini quota these public endpoints are rate-limited via the `api_usage` table: poster reading 5/hour per IP and 150/day site-wide, uploads 10/hour per IP and 300/day. Admin requests aren't limited.

### Duplicates and edits

`/admin` flags events that look like the same event (similar title on an overlapping day), including in the poster review before publishing. **Edit** changes any field or the poster without changing the event's link; edited Quicket events are no longer overwritten by the sync.

### Featured events

Organisers can request featuring (currently R350, `FEATURE_FEE` in `lib/site.ts`) from an event page or after submitting on `/submit`. The **Get featured** button opens their email app with a pre-filled request to `CONTACT_EMAIL` (whatsupdurbz@gmail.com); reply with payment details, then switch on ★ Feature in `/admin` once paid.

## Pages

| Route     | What it does |
|-----------|--------------|
| `/`       | Hero, featured carousel, interactive Durban map, filters (category / date / area / search) and event grid |
| `/submit` | Organiser submission form (optionally pre-filled from a poster) → inserted with `is_approved: false` |
| `/events/<slug>` | Event page with sharing, calendar and save |
| `/privacy`, `/data-deletion` | Privacy policy and data deletion instructions |
| `/admin`  | Moderation queue: approve, deny, feature, unpublish, **edit** (incl. replacing the poster); add events from posters; duplicate warnings; Quicket sync |

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

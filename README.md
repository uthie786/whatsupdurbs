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

## Quicket sync

Upcoming public Quicket events within ~45 km of Durban are imported into `events` (published, with "Get Tickets" linking to the Quicket page).

- Set these **server-only** env vars in Vercel (no `NEXT_PUBLIC_` prefix): `QUICKET_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.
- Run the migration block in `supabase/schema.sql` (adds `source` and `external_id`, and tightens the public insert policy).
- A Vercel Cron job (`vercel.json`) runs `/api/sync/quicket?mode=recent` daily at 05:00 SAST, picking up events changed in the last 3 days.
- On `/admin`, **Sync Quicket** runs a full import (it resumes page by page until done).
- Re-syncs update an event's details but never override your approve / feature / unpublish choices.
- Events are matched to the nearest of the six areas for filtering; their map pins use the real venue location.

Past events are hidden from the public site automatically (nothing is deleted).

## Pages

| Route     | What it does |
|-----------|--------------|
| `/`       | Hero, featured carousel, interactive Durban map, filters (category / date / area / search) and event grid |
| `/submit` | Organiser submission form → inserted with `is_approved: false` |
| `/admin`  | Moderation queue: 1-click approve, feature/unfeature, unpublish |

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

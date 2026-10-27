-- WhatsUpDurbs schema. Run in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  slug         text not null,
  description  text not null default '',
  category     text not null check (category in ('Markets','Concerts','Popups','Nightlife','Festive')),
  venue_name   text not null,
  address      text not null default '',
  area         text not null check (area in ('Umhlanga','Morningside','Durban North','Ballito','Central Beachfront','Point Waterfront')),
  latitude     double precision not null,
  longitude    double precision not null,
  start_date   timestamptz not null,
  end_date     timestamptz,
  image_url    text,
  ticket_url   text,
  price_text   text,
  is_featured  boolean not null default false,
  is_approved  boolean not null default false,
  source       text not null default 'manual',
  external_id  text unique,
  denied_at    timestamptz,
  created_at   timestamptz not null default now()
);

-- Migration for tables created before the Quicket sync existed:
alter table public.events
  add column if not exists source text not null default 'manual',
  add column if not exists external_id text unique;

-- Migration for admin "Deny": denied rows are purged 24h later.
alter table public.events add column if not exists denied_at timestamptz;

create index if not exists events_approved_start_idx on public.events (is_approved, start_date);

alter table public.events enable row level security;

-- Anyone can read approved events.
drop policy if exists "Public read approved events" on public.events;
create policy "Public read approved events"
  on public.events for select
  using (is_approved = true);

-- Anyone can submit, but only as unapproved, unfeatured.
drop policy if exists "Public submit pending events" on public.events;
create policy "Public submit pending events"
  on public.events for insert
  with check (is_approved = false and is_featured = false
              and source = 'manual' and external_id is null
              and denied_at is null);

-- Signed-in moderators can read everything and approve/feature events.
-- Tighten this further (e.g. a moderators table or a custom claim) for production.
drop policy if exists "Moderators read all" on public.events;
create policy "Moderators read all"
  on public.events for select
  to authenticated
  using (true);

drop policy if exists "Moderators update" on public.events;
create policy "Moderators update"
  on public.events for update
  to authenticated
  using (true)
  with check (true);

-- Hourly purge of submissions denied more than 24 hours ago.
-- (The Quicket sync also purges them as a backup.)
create extension if not exists pg_cron;
select cron.schedule(
  'purge-denied-events',
  '0 * * * *',
  $$delete from public.events where denied_at is not null and denied_at < now() - interval '24 hours'$$
);

-- Quicket sync cursor (service role only: RLS on, no policies).
create table if not exists public.sync_state (
  key          text primary key,
  last_success timestamptz,
  last_error   text,
  updated_at   timestamptz not null default now()
);
alter table public.sync_state enable row level security;

-- Hourly Quicket sync. Quicket's list API can only return ~2h of changes
-- before timing out, so it must run often. Replace the URL and secret.
create extension if not exists pg_net;
select cron.schedule(
  'quicket-sync',
  '7 * * * *',
  $$select net.http_get(
      url := 'https://YOUR-SITE.vercel.app/api/sync/quicket',
      headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET'),
      timeout_milliseconds := 60000)$$
);

-- Poster imports: admins publish events directly (as approved).
drop policy if exists "Admins insert events" on public.events;
create policy "Admins insert events"
  on public.events for insert
  to authenticated
  with check (true);

-- Public storage bucket for poster images uploaded from /admin.
insert into storage.buckets (id, name, public)
values ('posters', 'posters', true)
on conflict (id) do update set public = true;

drop policy if exists "Admins upload posters" on storage.objects;
create policy "Admins upload posters"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'posters');

drop policy if exists "Admins update posters" on storage.objects;
create policy "Admins update posters"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'posters');

drop policy if exists "Admins delete posters" on storage.objects;
create policy "Admins delete posters"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'posters');

-- Make PostgREST pick up new columns immediately.
notify pgrst, 'reload schema';

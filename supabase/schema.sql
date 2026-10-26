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
  created_at   timestamptz not null default now()
);

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
  with check (is_approved = false and is_featured = false);

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

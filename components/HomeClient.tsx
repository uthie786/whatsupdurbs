"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, Plus, Waves } from "lucide-react";
import type { AreaFilter, DateFilter, DurbsEvent, EventCategory } from "@/types/event";
import { fetchApprovedEvents, isSupabaseConfigured } from "@/lib/supabase";
import { EMPTY_RANGE, filterEvents, type DateRange } from "@/lib/filters";
import { distanceKm, eventPosition } from "@/lib/geo";
import { useSavedEvents } from "@/lib/useSavedEvents";
import { useNearMe } from "@/lib/useNearMe";
import Navbar from "./Navbar";
import FeaturedCarousel from "./FeaturedCarousel";
import MapSection from "./MapSection";
import FilterBar from "./FilterBar";
import EventGrid from "./EventGrid";
import Footer from "./Footer";

const MARQUEE = [
  "Markets",
  "Gigs",
  "Pop-ups",
  "Sundowners",
  "Festive Season",
  "Beach Days",
  "Bunny Chow",
  "Amapiano",
];

export default function HomeClient() {
  const [events, setEvents] = useState<DurbsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [area, setArea] = useState<AreaFilter>("All Areas");
  const [categories, setCategories] = useState<ReadonlySet<EventCategory>>(new Set());
  const [date, setDate] = useState<DateFilter>("All");
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);
  const [savedOnly, setSavedOnly] = useState(false);
  const { saved, count: savedCount } = useSavedEvents();
  const nearMe = useNearMe();

  const toggleCategory = (c: EventCategory) =>
    setCategories((current) => {
      const next = new Set(current);
      if (!next.delete(c)) next.add(c);
      return next;
    });
  const clearCategories = () => setCategories(new Set());

  // Quick "When" chips and the custom range are mutually exclusive.
  const changeDate = (value: DateFilter) => {
    setDate(value);
    if (value !== "All") setRange(EMPTY_RANGE);
  };
  const changeRange = (value: DateRange) => {
    const swapped = value.from && value.to && value.from > value.to;
    setRange(swapped ? { from: value.to, to: value.from } : value);
    if (value.from || value.to) setDate("All");
  };

  useEffect(() => {
    let cancelled = false;
    fetchApprovedEvents()
      .then((data) => !cancelled && setEvents(data))
      .catch((e: unknown) =>
        !cancelled && setError(e instanceof Error ? e.message : "Could not load events"),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Every filter except category: decides which category tags are offered.
  const withoutCategory = useMemo(() => {
    const list = filterEvents(events, { search, area, categories: new Set(), date, range });
    return savedOnly ? list.filter((e) => saved.has(e.id)) : list;
  }, [events, search, area, date, range, savedOnly, saved]);

  const matching = useMemo(
    () => (categories.size ? withoutCategory.filter((e) => categories.has(e.category)) : withoutCategory),
    [withoutCategory, categories],
  );

  // With "near me" on, closest events come first and cards show the distance.
  const distances = useMemo(() => {
    if (!nearMe.location) return null;
    const here = nearMe.location;
    return new Map(matching.map((e) => [e.id, distanceKm(here, eventPosition(e))]));
  }, [matching, nearMe.location]);

  const filtered = useMemo(
    () => (distances ? [...matching].sort((a, b) => distances.get(a.id)! - distances.get(b.id)!) : matching),
    [matching, distances],
  );
  const featured = useMemo(() => events.filter((e) => e.is_featured), [events]);

  const resetFilters = () => {
    setSearch("");
    setArea("All Areas");
    clearCategories();
    setDate("All");
    setRange(EMPTY_RANGE);
    setSavedOnly(false);
  };

  return (
    <>
      <Navbar search={search} onSearchChange={setSearch} area={area} onAreaChange={setArea} />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b-4 border-black bg-durbs-cyan">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 md:grid-cols-[1.4fr_1fr] md:py-20">
            <div className="space-y-6">
              <span className="brutal-badge rotate-[-2deg] bg-white text-xs">
                <Waves className="h-3.5 w-3.5" /> Durban · eThekwini · KZN
              </span>
              <h1 className="font-display text-5xl uppercase leading-[0.95] sm:text-6xl lg:text-7xl">
                What&apos;s up,{" "}
                <span className="inline-block -rotate-1 border-4 border-black bg-durbs-pink px-2 text-white shadow-brutal-lg">
                  Durbs?
                </span>
              </h1>
              <p className="max-w-xl text-lg font-semibold">
                Markets, gigs, pop-ups, nightlife and festive madness — from Umhlanga to the
                Point, Ballito to Morningside. All in one loud little hub.
              </p>
              <div className="flex flex-wrap gap-3">
                <a href="#events" className="brutal-btn bg-durbs-yellow text-base">
                  Find something <ArrowDown className="h-4 w-4" strokeWidth={3} />
                </a>
                <Link href="/submit" className="brutal-btn bg-black text-base text-white">
                  List your event <Plus className="h-4 w-4" strokeWidth={3} />
                </Link>
              </div>
            </div>
            <div className="hidden grid-cols-2 gap-4 self-center md:grid">
              {[
                { n: events.length || "—", l: "Live events", c: "bg-durbs-yellow" },
                { n: featured.length || "—", l: "Featured", c: "bg-durbs-pink text-white" },
                { n: 6, l: "Hot areas", c: "bg-durbs-purple text-white" },
                { n: "365", l: "Days of sun*", c: "bg-white" },
              ].map((s, i) => (
                <div
                  key={s.l}
                  className={`border-4 border-black p-4 shadow-brutal-lg ${s.c} ${
                    i % 2 ? "rotate-2" : "-rotate-2"
                  }`}
                >
                  <div className="font-display text-4xl">{s.n}</div>
                  <div className="text-xs font-black uppercase">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-hidden border-t-4 border-black bg-black py-2 text-durbs-yellow">
            {/* Two identical groups, each at least viewport-wide, so -50% loops seamlessly. */}
            <div className="animate-marquee flex w-max whitespace-nowrap font-display text-lg uppercase">
              {[0, 1].map((copy) => (
                <div
                  key={copy}
                  aria-hidden={copy === 1}
                  className="flex min-w-[100vw] shrink-0 items-center justify-around gap-8 pr-8"
                >
                  {MARQUEE.map((w) => (
                    <span key={w}>
                      {w} <span className="text-durbs-pink">✱</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {!isSupabaseConfigured && (
          <div className="mx-auto mt-6 max-w-7xl px-4">
            <p className="border-3 border-black bg-durbs-purple px-4 py-2 text-sm font-bold text-white shadow-brutal">
              Demo mode: Supabase isn&apos;t configured, so you&apos;re seeing sample Durban events.
            </p>
          </div>
        )}
        {error && (
          <div className="mx-auto mt-6 max-w-7xl px-4">
            <p className="border-3 border-black bg-red-500 px-4 py-2 font-bold text-white shadow-brutal">
              {error}
            </p>
          </div>
        )}

        <FeaturedCarousel events={featured} />

        <MapSection
          events={filtered}
          legendEvents={withoutCategory}
          categories={categories}
          onToggleCategory={toggleCategory}
          onClearCategories={clearCategories}
          dateRange={range}
          onDateRangeChange={changeRange}
          nearMeStatus={nearMe.status}
          onNearMeToggle={nearMe.toggle}
          nearMeError={nearMe.error}
          userLocation={nearMe.location}
        />

        <section id="events" className="mx-auto max-w-7xl scroll-mt-28 space-y-6 px-4 py-10">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-display text-3xl uppercase sm:text-4xl">
              All the <span className="bg-durbs-yellow px-2">jols</span>
            </h2>
            <span className="brutal-badge bg-white text-xs">
              {loading ? "Loading…" : `${filtered.length} event${filtered.length === 1 ? "" : "s"}`}
            </span>
          </div>
          <FilterBar
            categories={categories}
            onToggleCategory={toggleCategory}
            onClearCategories={clearCategories}
            date={date}
            area={area}
            onDateChange={changeDate}
            dateRange={range}
            onDateRangeChange={changeRange}
            onAreaChange={setArea}
            savedOnly={savedOnly}
            savedCount={savedCount}
            onSavedOnlyChange={setSavedOnly}
            nearMeStatus={nearMe.status}
            onNearMeToggle={nearMe.toggle}
            onReset={resetFilters}
          />
          {nearMe.status === "on" && (
            <p className="text-xs font-bold text-neutral-600">
              Sorted by distance from you. Events listed by area use the area centre.
            </p>
          )}
          <EventGrid
            events={filtered}
            loading={loading}
            onReset={resetFilters}
            distances={distances}
            emptyMessage={
              savedOnly && savedCount === 0
                ? "No saved events yet. Tap the ❤️ on any event to keep it here."
                : undefined
            }
          />
        </section>
      </main>

      <Footer />
    </>
  );
}

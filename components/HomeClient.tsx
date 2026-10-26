"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, Plus, Waves } from "lucide-react";
import type { AreaFilter, CategoryFilter, DateFilter, DurbsEvent } from "@/types/event";
import { fetchApprovedEvents, isSupabaseConfigured } from "@/lib/supabase";
import { filterEvents } from "@/lib/filters";
import Navbar from "./Navbar";
import FeaturedCarousel from "./FeaturedCarousel";
import MapSection from "./MapSection";
import FilterBar from "./FilterBar";
import EventGrid from "./EventGrid";

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
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [date, setDate] = useState<DateFilter>("All");

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

  const filtered = useMemo(
    () => filterEvents(events, { search, area, category, date }),
    [events, search, area, category, date],
  );
  const featured = useMemo(() => events.filter((e) => e.is_featured), [events]);

  const resetFilters = () => {
    setSearch("");
    setArea("All Areas");
    setCategory("All");
    setDate("All");
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
            <div className="animate-marquee flex w-max gap-8 whitespace-nowrap font-display text-lg uppercase">
              {[...MARQUEE, ...MARQUEE].map((w, i) => (
                <span key={i}>
                  {w} <span className="text-durbs-pink">✱</span>
                </span>
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

        <MapSection events={filtered} />

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
            category={category}
            date={date}
            area={area}
            onCategoryChange={setCategory}
            onDateChange={setDate}
            onAreaChange={setArea}
            onReset={resetFilters}
          />
          <EventGrid events={filtered} loading={loading} onReset={resetFilters} />
        </section>
      </main>

      <footer className="border-t-4 border-black bg-black text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8">
          <p className="font-display text-xl">
            WhatsUp<span className="text-durbs-pink">Durbs</span> 🌊
          </p>
          <p className="text-sm font-semibold text-neutral-300">
            Made with sunshine &amp; sea salt in Durban. *Roughly.
          </p>
          <Link href="/submit" className="brutal-btn bg-durbs-yellow text-black">
            Submit Event <Plus className="h-4 w-4" />
          </Link>
        </div>
      </footer>
    </>
  );
}

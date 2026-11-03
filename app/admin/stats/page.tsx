"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, Loader2, Search, Star, Ticket } from "lucide-react";
import Navbar from "@/components/Navbar";
import EventImage from "@/components/EventImage";
import type { DurbsEvent } from "@/types/event";
import { CATEGORY_BG, CATEGORY_INFO } from "@/lib/areas";
import { fetchAllEventsForAdmin, isSupabaseConfigured, supabase } from "@/lib/supabase";
import { fetchStats, type StatRow } from "@/lib/stats";
import { sastDayKey } from "@/lib/time";
import { errorMessage } from "@/lib/errors";
import { eventPath } from "@/lib/site";

type Range = 7 | 30 | "all";
type SortBy = "views" | "tickets";
const DAY_MS = 24 * 60 * 60 * 1000;

const dayKeyAgo = (days: number) => sastDayKey(new Date(Date.now() - days * DAY_MS));
const pct = (tickets: number, views: number) => (views ? `${Math.round((tickets / views) * 100)}%` : "–");

/** Daily views as a tiny bar chart. */
function Sparkline({ days, values }: { days: string[]; values: number[] }) {
  const max = Math.max(1, ...values);
  const w = 100 / days.length;
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-16 w-full" role="img" aria-label="Daily views">
      {values.map((v, i) => (
        <rect key={days[i]} x={i * w + w * 0.15} width={w * 0.7} y={30 - (v / max) * 28} height={(v / max) * 28} fill="#000">
          <title>
            {days[i]}: {v} views
          </title>
        </rect>
      ))}
    </svg>
  );
}

export default function StatsPage() {
  const [authed, setAuthed] = useState<boolean | null>(isSupabaseConfigured ? null : true);
  const [range, setRange] = useState<Range>(7);
  const [sortBy, setSortBy] = useState<SortBy>("views");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<StatRow[]>([]);
  const [events, setEvents] = useState<DurbsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
  }, []);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    // The chart always covers at least the visible days.
    const from = range === "all" ? null : dayKeyAgo(range - 1);
    Promise.all([fetchStats(from), events.length ? Promise.resolve(events) : fetchAllEventsForAdmin()])
      .then(([r, e]) => {
        if (cancelled) return;
        setRows(r);
        setEvents(e);
      })
      .catch((e: unknown) => !cancelled && setError(errorMessage(e, "Couldn't load stats.")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- events are loaded once
  }, [authed, range]);

  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const table = useMemo(() => {
    const totals = new Map<string, { views: number; tickets: number }>();
    for (const r of rows) {
      const t = totals.get(r.event_id) ?? { views: 0, tickets: 0 };
      if (r.kind === "view") t.views += r.count;
      else t.tickets += r.count;
      totals.set(r.event_id, t);
    }
    const q = query.trim().toLowerCase();
    return [...totals.entries()]
      .map(([id, t]) => ({ id, event: byId.get(id), ...t }))
      .filter((r) => r.event && (!q || `${r.event.title} ${r.event.venue_name}`.toLowerCase().includes(q)))
      .sort((a, b) => (sortBy === "views" ? b.views - a.views || b.tickets - a.tickets : b.tickets - a.tickets || b.views - a.views));
  }, [rows, byId, query, sortBy]);

  const totalViews = table.reduce((s, r) => s + r.views, 0);
  const totalTickets = table.reduce((s, r) => s + r.tickets, 0);
  const maxViews = Math.max(1, ...table.map((r) => r.views));

  const chartDays = useMemo(() => {
    const n = range === 7 ? 7 : 30;
    return Array.from({ length: n }, (_, i) => dayKeyAgo(n - 1 - i));
  }, [range]);
  const chartValues = chartDays.map((d) =>
    rows.filter((r) => r.day === d && r.kind === "view").reduce((s, r) => s + r.count, 0),
  );

  return (
    <>
      <Navbar compact />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm font-black uppercase underline decoration-2 underline-offset-4">
          <ArrowLeft className="h-4 w-4" /> Admin
        </Link>
        <div className="space-y-2">
          <span className="brutal-badge bg-durbs-purple text-white">Stats</span>
          <h1 className="font-display text-4xl uppercase leading-none">Event stats</h1>
          <p className="max-w-2xl font-semibold">
            How often each event page was opened and its ticket link tapped. Anonymous totals only: no cookies or
            personal data, and admins signed in aren&apos;t counted.
          </p>
        </div>

        {authed === null && <Loader2 className="h-8 w-8 animate-spin" />}
        {authed === false && (
          <p className="border-3 border-black bg-durbs-yellow px-4 py-3 font-bold shadow-brutal">
            Sign in on the <Link href="/admin" className="underline">admin page</Link> first.
          </p>
        )}

        {authed && (
          <>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Time range">
              {([7, 30, "all"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={range === r}
                  onClick={() => setRange(r)}
                  className="brutal-chip"
                >
                  {r === "all" ? "All time" : `Last ${r} days`}
                </button>
              ))}
            </div>

            {error && <p className="border-3 border-black bg-red-500 px-4 py-2 font-bold text-white">{error}</p>}

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="border-3 border-black bg-durbs-cyan p-2.5 sm:p-4 shadow-brutal">
                <p className="flex items-center gap-1 font-display text-[10px] uppercase sm:text-xs"><Eye className="h-3.5 w-3.5 shrink-0" /> Views</p>
                <p className="font-display text-2xl sm:text-4xl">{totalViews}</p>
              </div>
              <div className="border-3 border-black bg-durbs-pink p-2.5 sm:p-4 text-white shadow-brutal">
                <p className="flex items-center gap-1 font-display text-[10px] uppercase sm:text-xs"><Ticket className="h-3.5 w-3.5 shrink-0" /> Tickets</p>
                <p className="font-display text-2xl sm:text-4xl">{totalTickets}</p>
              </div>
              <div className="border-3 border-black bg-durbs-yellow p-2.5 sm:p-4 shadow-brutal">
                <p className="font-display text-[10px] uppercase sm:text-xs">Click-through</p>
                <p className="font-display text-2xl sm:text-4xl">{pct(totalTickets, totalViews)}</p>
              </div>
            </div>

            <div className="border-3 border-black bg-white p-4 shadow-brutal">
              <p className="mb-2 font-display text-xs uppercase">
                Views per day ({range === 7 ? "last 7 days" : "last 30 days"})
              </p>
              <Sparkline days={chartDays} values={chartValues} />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="relative sm:w-80">
                <span className="sr-only">Search events</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by event or venue…"
                  className="brutal-input pl-9"
                />
              </label>
              <div className="flex gap-2" role="group" aria-label="Sort by">
                {(["views", "tickets"] as const).map((s) => (
                  <button key={s} type="button" aria-pressed={sortBy === s} onClick={() => setSortBy(s)} className="brutal-chip">
                    Most {s === "views" ? "viewed" : "ticket clicks"}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : table.length === 0 ? (
              <p className="border-4 border-dashed border-black p-8 text-center font-display text-xl uppercase">
                No views {range === "all" ? "yet" : "in this period"}.
              </p>
            ) : (
              <ol className="space-y-3">
                {table.map((r, i) => (
                  <li
                    key={r.id}
                    className="grid grid-cols-[28px_64px_minmax(0,1fr)] items-center gap-3 border-3 border-black bg-white p-3 shadow-brutal sm:grid-cols-[28px_64px_minmax(0,1fr)_auto]"
                  >
                    <span className="font-display text-lg">{i + 1}</span>
                    {r.event!.image_url ? (
                      <EventImage
                        src={r.event!.image_url}
                        alt=""
                        category={r.event!.category}
                        className="h-16 w-16 border-2 border-black object-cover"
                      />
                    ) : (
                      <span className={`grid h-16 w-16 place-items-center border-2 border-black text-2xl ${CATEGORY_BG[r.event!.category]}`}>
                        {CATEGORY_INFO[r.event!.category].emoji}
                      </span>
                    )}
                    <div className="min-w-0 space-y-1">
                      <Link href={eventPath(r.event!)} className="block truncate font-display uppercase hover:underline">
                        {r.event!.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`brutal-badge ${CATEGORY_BG[r.event!.category]}`}>{r.event!.category}</span>
                        <span className="brutal-badge bg-white">{r.event!.area}</span>
                        {r.event!.is_featured && (
                          <span className="brutal-badge bg-durbs-yellow">
                            <Star className="h-3 w-3 fill-black" /> Featured
                          </span>
                        )}
                      </div>
                      <div className="h-2 border-2 border-black bg-neutral-100">
                        <div className="h-full bg-durbs-cyan" style={{ width: `${(r.views / maxViews) * 100}%` }} />
                      </div>
                    </div>
                    <div className="col-span-3 flex justify-end gap-2 text-sm font-black sm:col-span-1">
                      <span className="brutal-badge bg-durbs-cyan !text-xs">
                        <Eye className="h-3.5 w-3.5" /> {r.views}
                      </span>
                      <span className="brutal-badge bg-durbs-pink !text-xs text-white">
                        <Ticket className="h-3.5 w-3.5" /> {r.tickets}
                      </span>
                      <span className="brutal-badge bg-white !text-xs">{pct(r.tickets, r.views)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </main>
    </>
  );
}

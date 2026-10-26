"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Loader2, LogOut, RefreshCw, Star, Undo2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import EventImage from "@/components/EventImage";
import type { DurbsEvent } from "@/types/event";
import { CATEGORY_BG } from "@/lib/areas";
import { formatEventDate } from "@/lib/filters";
import {
  fetchAllEventsForAdmin,
  isSupabaseConfigured,
  supabase,
  updateEventFlags,
} from "@/lib/supabase";

type Tab = "pending" | "approved";

function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message);
    else onSignedIn();
  }

  return (
    <form
      onSubmit={handle}
      className="mx-auto max-w-md space-y-4 border-4 border-black bg-white p-6 shadow-brutal-xl"
    >
      <h2 className="font-display text-2xl uppercase">Moderator sign-in</h2>
      <input
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="brutal-input"
      />
      <input
        type="password"
        required
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="brutal-input"
      />
      {error && <p className="font-bold text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className="brutal-btn w-full bg-durbs-yellow">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
      </button>
    </form>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(isSupabaseConfigured ? null : true);
  const [events, setEvents] = useState<DurbsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEvents(await fetchAllEventsForAdmin());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  async function patch(id: string, flags: Partial<Pick<DurbsEvent, "is_approved" | "is_featured">>) {
    const previous = events;
    setBusyId(id);
    setEvents((list) => list.map((e) => (e.id === id ? { ...e, ...flags } : e)));
    try {
      await updateEventFlags(id, flags);
    } catch (e) {
      setEvents(previous);
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  const pending = events.filter((e) => !e.is_approved);
  const approved = events.filter((e) => e.is_approved);
  const visible = tab === "pending" ? pending : approved;

  return (
    <>
      <Navbar compact />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <span className="brutal-badge bg-durbs-purple text-white">Moderation</span>
            <h1 className="font-display text-4xl uppercase leading-none">Admin dashboard</h1>
          </div>
          {authed && (
            <div className="flex gap-2">
              <button type="button" onClick={load} className="brutal-btn bg-white">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
              {supabase && (
                <button
                  type="button"
                  onClick={() => supabase?.auth.signOut()}
                  className="brutal-btn bg-black text-white"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              )}
            </div>
          )}
        </div>

        {!isSupabaseConfigured && (
          <p className="border-3 border-black bg-durbs-purple px-4 py-2 text-sm font-bold text-white shadow-brutal">
            Demo mode: changes apply to in-memory sample data only.
          </p>
        )}

        {authed === null && <Loader2 className="h-8 w-8 animate-spin" />}
        {authed === false && <SignIn onSignedIn={() => setAuthed(true)} />}

        {authed && (
          <>
            <div className="flex gap-3" role="tablist">
              {(
                [
                  ["pending", `Pending (${pending.length})`, "bg-durbs-pink text-white"],
                  ["approved", `Live (${approved.length})`, "bg-durbs-cyan"],
                ] as const
              ).map(([key, label, active]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={`brutal-btn ${tab === key ? active : "bg-white"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {error && (
              <p className="border-3 border-black bg-red-500 px-4 py-2 font-bold text-white">{error}</p>
            )}

            {loading ? (
              <p className="font-bold">Loading…</p>
            ) : visible.length === 0 ? (
              <p className="border-4 border-dashed border-black p-8 text-center font-display text-xl uppercase">
                {tab === "pending" ? "Queue's empty. Go to the beach. 🏖️" : "Nothing live yet."}
              </p>
            ) : (
              <ul className="space-y-4">
                {visible.map((event) => (
                  <li
                    key={event.id}
                    className="grid gap-4 border-3 border-black bg-white p-4 shadow-brutal sm:grid-cols-[140px_1fr_auto]"
                  >
                    <EventImage
                      src={event.image_url}
                      alt={event.title}
                      category={event.category}
                      className="h-28 w-full border-3 border-black sm:w-[140px]"
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap gap-2">
                        <span className={`brutal-badge ${CATEGORY_BG[event.category]}`}>
                          {event.category}
                        </span>
                        <span className="brutal-badge bg-white">{event.area}</span>
                        {event.is_featured && (
                          <span className="brutal-badge bg-durbs-yellow">
                            <Star className="h-3 w-3 fill-black" /> Featured
                          </span>
                        )}
                      </div>
                      <h2 className="font-display text-lg uppercase">{event.title}</h2>
                      <p className="text-xs font-bold">
                        {formatEventDate(event)} · {event.venue_name}
                        {event.price_text ? ` · ${event.price_text}` : ""}
                      </p>
                      <p className="line-clamp-2 text-sm text-neutral-700">{event.description}</p>
                      {event.ticket_url && (
                        <a
                          href={event.ticket_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-xs font-bold text-durbs-purple underline"
                        >
                          {event.ticket_url}
                        </a>
                      )}
                    </div>
                    <div className="flex flex-row gap-2 sm:flex-col">
                      {event.is_approved ? (
                        <button
                          type="button"
                          disabled={busyId === event.id}
                          onClick={() => patch(event.id, { is_approved: false, is_featured: false })}
                          className="brutal-btn bg-white !text-xs"
                        >
                          <Undo2 className="h-4 w-4" /> Unpublish
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === event.id}
                          onClick={() => patch(event.id, { is_approved: true })}
                          className="brutal-btn bg-green-400 !text-xs"
                        >
                          <Check className="h-4 w-4" strokeWidth={3} /> Approve
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === event.id}
                        onClick={() =>
                          patch(event.id, {
                            is_featured: !event.is_featured,
                            // Featuring an event also publishes it.
                            ...(!event.is_featured ? { is_approved: true } : {}),
                          })
                        }
                        className={`brutal-btn !text-xs ${
                          event.is_featured ? "bg-black text-durbs-yellow" : "bg-durbs-yellow"
                        }`}
                      >
                        <Star className="h-4 w-4" /> {event.is_featured ? "Unfeature" : "Feature"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </>
  );
}

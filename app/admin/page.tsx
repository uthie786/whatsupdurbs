"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, Ban, Check, CloudDownload, Loader2, LogOut, Pencil, RefreshCw, RotateCcw, Star, Undo2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import EventImage from "@/components/EventImage";
import BulkPosterImport from "@/components/BulkPosterImport";
import EditEventPanel from "@/components/EditEventPanel";
import AdminFilters, {
  EMPTY_ADMIN_FILTERS,
  isAdminFilterActive,
  matchesAdminFilters,
  type AdminFilterState,
} from "@/components/AdminFilters";
import { findLikelyDuplicates } from "@/lib/duplicates";
import type { DurbsEvent } from "@/types/event";
import { CATEGORY_BG } from "@/lib/areas";
import { formatEventDate } from "@/lib/filters";
import {
  DENIED_RETENTION_MS,
  fetchAllEventsForAdmin,
  isSupabaseConfigured,
  supabase,
  updateEventFlags,
  type EventFlagsPatch,
} from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";

function hoursUntilPurge(deniedAt: string): number {
  const ms = new Date(deniedAt).getTime() + DENIED_RETENTION_MS - Date.now();
  return Math.max(0, Math.ceil(ms / 3_600_000));
}

type Tab = "pending" | "approved" | "denied";

interface SyncResponse {
  ok: boolean;
  processed: number;
  inserted: number;
  updated: number;
  failed: number;
  since?: string;
  notes?: string[];
  lastSuccess?: string | null;
  error?: string;
  transient?: boolean;
}

function minutesAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

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
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<AdminFilterState>(EMPTY_ADMIN_FILTERS);

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
      setError(errorMessage(e, "Failed to load events"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  async function adminToken(): Promise<string> {
    const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
    const token = data.session?.access_token;
    if (!token) throw new Error("Your session expired, please sign in again.");
    return token;
  }

  async function syncQuicket() {
    if (!supabase) return;
    setSyncing(true);
    setError(null);
    setSyncNotice(null);
    setSyncStatus("Syncing Quicket… this can take up to a minute (Quicket is slow).");
    try {
      const res = await fetch("/api/sync/quicket", {
        headers: { Authorization: `Bearer ${await adminToken()}` },
      });
      const body = (await res.json().catch(() => ({}))) as Partial<SyncResponse>;
      const lastOk = body.lastSuccess ? ` Last successful sync ${minutesAgo(body.lastSuccess)}.` : "";
      if (body.transient) {
        setSyncNotice(`${body.error}${lastOk}`);
        setSyncStatus(null);
        return;
      }
      if (!res.ok || !body.ok) {
        throw new Error((body.error || `Sync failed (${res.status})`) + lastOk);
      }
      setSyncStatus(
        `Quicket sync done: ${body.processed ?? 0} changed events checked · ${body.inserted ?? 0} new · ${body.updated ?? 0} updated` +
          (body.failed ? ` · ${body.failed} failed` : "") +
          (body.notes?.length ? ` · ${body.notes.join(" ")}` : ""),
      );
      await load();
    } catch (e) {
      setSyncStatus(null);
      setError(errorMessage(e, "Quicket sync failed"));
    } finally {
      setSyncing(false);
    }
  }

  async function patch(id: string, flags: EventFlagsPatch) {
    const previous = events;
    setBusyId(id);
    setEvents((list) => list.map((e) => (e.id === id ? { ...e, ...flags } : e)));
    try {
      await updateEventFlags(id, flags);
    } catch (e) {
      setEvents(previous);
      setError(errorMessage(e, "Update failed"));
    } finally {
      setBusyId(null);
    }
  }

  const pending = events.filter((e) => !e.is_approved && !e.denied_at);
  const approved = events.filter((e) => e.is_approved);
  const denied = events.filter((e) => !e.is_approved && e.denied_at);
  const tabEvents = tab === "pending" ? pending : tab === "approved" ? approved : denied;
  const filtering = isAdminFilterActive(filters);
  const visible = filtering ? tabEvents.filter((e) => matchesAdminFilters(e, filters)) : tabEvents;
  /** "Live (12)" or, while filtering, "Live (3 of 12)". */
  const tabCount = (list: DurbsEvent[]) =>
    filtering ? `${list.filter((e) => matchesAdminFilters(e, filters)).length} of ${list.length}` : String(list.length);

  // Likely duplicates among live and pending events (denied ones are on their way out).
  const duplicatesById = useMemo(() => {
    const active = events.filter((e) => !e.denied_at);
    return new Map(active.map((e) => [e.id, findLikelyDuplicates(e, active)]));
  }, [events]);

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
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={load} className="brutal-btn bg-white">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
              {supabase && (
                <button
                  type="button"
                  onClick={syncQuicket}
                  disabled={syncing}
                  className="brutal-btn bg-durbs-cyan"
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CloudDownload className="h-4 w-4" />
                  )}
                  Sync Quicket now
                </button>
              )}
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

        {authed && <BulkPosterImport onPublished={load} existingEvents={events} />}

        {syncNotice && (
          <p className="border-3 border-black bg-durbs-yellow px-4 py-2 text-sm font-bold shadow-brutal">
            ⏳ {syncNotice}
          </p>
        )}

        {syncStatus && (
          <p className="border-3 border-black bg-durbs-cyan px-4 py-2 text-sm font-bold shadow-brutal">
            {syncStatus}
          </p>
        )}

        {authed === null && <Loader2 className="h-8 w-8 animate-spin" />}
        {authed === false && <SignIn onSignedIn={() => setAuthed(true)} />}

        {authed && (
          <>
            <div className="flex flex-wrap gap-3" role="tablist">
              {(
                [
                  ["pending", `Pending (${tabCount(pending)})`, "bg-durbs-pink text-white"],
                  ["approved", `Live (${tabCount(approved)})`, "bg-durbs-cyan"],
                  ["denied", `Denied (${tabCount(denied)})`, "bg-black text-white"],
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

            <AdminFilters value={filters} onChange={setFilters} tabEvents={tabEvents} />

            {error && (
              <p className="border-3 border-black bg-red-500 px-4 py-2 font-bold text-white">{error}</p>
            )}

            {loading ? (
              <p className="font-bold">Loading…</p>
            ) : visible.length === 0 && filtering ? (
              <div className="flex flex-col items-center gap-3 border-4 border-dashed border-black p-8 text-center">
                <p className="font-display text-xl uppercase">No events match these filters.</p>
                <button type="button" onClick={() => setFilters(EMPTY_ADMIN_FILTERS)} className="brutal-btn bg-durbs-cyan">
                  Clear filters
                </button>
              </div>
            ) : visible.length === 0 ? (
              <p className="border-4 border-dashed border-black p-8 text-center font-display text-xl uppercase">
                {tab === "pending"
                  ? "Queue's empty. Go to the beach. 🏖️"
                  : tab === "approved"
                    ? "Nothing live yet."
                    : "No denied submissions."}
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
                        {event.source === "quicket" && (
                          <span className="brutal-badge bg-black text-white">Quicket</span>
                        )}
                        {event.denied_at && !event.is_approved && (
                          <span className="brutal-badge bg-red-500 text-white">
                            Denied · deletes in ~{hoursUntilPurge(event.denied_at)}h
                          </span>
                        )}
                        {event.is_featured && (
                          <span className="brutal-badge bg-durbs-yellow">
                            <Star className="h-3 w-3 fill-black" /> Featured
                          </span>
                        )}
                        {event.edited_at && <span className="brutal-badge bg-white">Edited</span>}
                      </div>
                      {(duplicatesById.get(event.id) ?? []).length > 0 && (
                        <p className="flex items-start gap-1 text-xs font-black text-durbs-pink">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Possible duplicate of{" "}
                          {(duplicatesById.get(event.id) ?? [])
                            .slice(0, 2)
                            .map((d) => `"${d.title}"${d.is_approved ? "" : " (pending)"}`)
                            .join(", ")}
                        </p>
                      )}
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
                    <div className="flex flex-row flex-wrap gap-2 sm:flex-col">
                      <button
                        type="button"
                        onClick={() => setEditingId(editingId === event.id ? null : event.id)}
                        aria-expanded={editingId === event.id}
                        className="brutal-btn bg-white !text-xs"
                      >
                        <Pencil className="h-4 w-4" /> Edit
                      </button>
                      {event.denied_at && !event.is_approved ? (
                        <button
                          type="button"
                          disabled={busyId === event.id}
                          onClick={() => patch(event.id, { denied_at: null })}
                          className="brutal-btn bg-white !text-xs"
                        >
                          <RotateCcw className="h-4 w-4" /> Restore
                        </button>
                      ) : (
                        <>
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
                            <>
                              <button
                                type="button"
                                disabled={busyId === event.id}
                                onClick={() => patch(event.id, { is_approved: true, denied_at: null })}
                                className="brutal-btn bg-green-400 !text-xs"
                              >
                                <Check className="h-4 w-4" strokeWidth={3} /> Approve
                              </button>
                              <button
                                type="button"
                                disabled={busyId === event.id}
                                onClick={() =>
                                  patch(event.id, {
                                    denied_at: new Date().toISOString(),
                                    is_approved: false,
                                    is_featured: false,
                                  })
                                }
                                className="brutal-btn bg-red-500 !text-xs text-white"
                              >
                                <Ban className="h-4 w-4" strokeWidth={3} /> Deny
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            disabled={busyId === event.id}
                            onClick={() =>
                              patch(event.id, {
                                is_featured: !event.is_featured,
                                // Featuring an event also publishes it.
                                ...(!event.is_featured ? { is_approved: true, denied_at: null } : {}),
                              })
                            }
                            className={`brutal-btn !text-xs ${
                              event.is_featured ? "bg-black text-durbs-yellow" : "bg-durbs-yellow"
                            }`}
                          >
                            <Star className="h-4 w-4" /> {event.is_featured ? "Unfeature" : "Feature"}
                          </button>
                        </>
                      )}
                    </div>
                    {editingId === event.id && (
                      <EditEventPanel
                        event={event}
                        onCancel={() => setEditingId(null)}
                        onSaved={(changes) => {
                          setEvents((list) =>
                            list.map((e) =>
                              e.id === event.id ? { ...e, ...changes, edited_at: new Date().toISOString() } : e,
                            ),
                          );
                          setEditingId(null);
                        }}
                      />
                    )}
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

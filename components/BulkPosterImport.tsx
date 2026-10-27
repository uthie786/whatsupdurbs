"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Pencil,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import EventFormFields, { EMPTY_EVENT_FORM, buildEventInput } from "./EventForm";
import PosterDropZone from "./PosterDropZone";
import type { DurbsEvent } from "@/types/event";
import type { PosterFields } from "@/lib/gemini";
import { publishEvent, supabase, uploadPoster } from "@/lib/supabase";
import { blobToBase64, resizeImage } from "@/lib/images";
import { errorMessage } from "@/lib/errors";
import { formatEventDate } from "@/lib/filters";
import { fromSastLocalInput } from "@/lib/time";
import {
  MAX_BATCH,
  applyReading,
  editForm,
  isReadyToPublish,
  itemIssues,
  type BulkItem,
  type BulkStatus,
} from "@/lib/bulkImport";

/** Wait this long when Gemini's free per-minute limit is hit. */
const RATE_LIMIT_PAUSE_MS = 45_000;
const MAX_RATE_LIMIT_RETRIES = 3;

class ReadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function readPoster(blob: Blob): Promise<{ fields: PosterFields; notes: string | null }> {
  if (!supabase) throw new ReadError("Demo mode: AI reading needs Supabase and a Gemini key. Fill it in by hand.", 503);
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ReadError("Your session expired, please sign in again.", 401);
  const res = await fetch("/api/extract-poster", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ imageBase64: await blobToBase64(blob), mimeType: "image/jpeg" }),
  });
  const body = (await res.json().catch(() => ({}))) as { fields?: PosterFields; notes?: string | null; error?: string };
  if (!res.ok || !body.fields) throw new ReadError(body.error || `Reading failed (${res.status})`, res.status);
  return { fields: body.fields, notes: body.notes ?? null };
}

const STATUS_STYLE: Record<BulkStatus, { label: string; className: string }> = {
  queued: { label: "Waiting", className: "bg-white" },
  reading: { label: "Reading…", className: "bg-durbs-cyan" },
  ready: { label: "Ready", className: "bg-green-400" },
  "needs-check": { label: "Check details", className: "bg-durbs-yellow" },
  "no-event": { label: "No event found", className: "bg-neutral-300" },
  failed: { label: "Couldn't read", className: "bg-red-500 text-white" },
  publishing: { label: "Publishing…", className: "bg-durbs-cyan" },
  published: { label: "Published", className: "bg-black text-white" },
};

interface BulkPosterImportProps {
  onPublished: () => void;
  /** Events already on the site, to warn about duplicates. */
  existingEvents?: DurbsEvent[];
}

export default function BulkPosterImport({ onPublished, existingEvents = [] }: BulkPosterImportProps) {
  const [items, setItems] = useState<BulkItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pausedUntil, setPausedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [publishingAll, setPublishingAll] = useState(false);
  const busy = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const update = useCallback((id: string, patch: Partial<BulkItem>) => {
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  // Free object URLs for items that are gone.
  useEffect(
    () => () => {
      itemsRef.current.forEach((it) => URL.revokeObjectURL(it.preview));
    },
    [],
  );

  const addFiles = useCallback(async (files: File[]) => {
    setNotice(null);
    const waiting = itemsRef.current.filter((it) => it.status !== "published").length;
    const room = MAX_BATCH - waiting;
    if (room <= 0) {
      setNotice(`A batch holds up to ${MAX_BATCH} posters. Publish or remove some first.`);
      return;
    }
    const accepted = files.slice(0, room);
    if (files.length > room) setNotice(`Only ${room} more fit in this batch; the other ${files.length - room} were skipped.`);
    const added: BulkItem[] = [];
    for (const file of accepted) {
      try {
        const blob = await resizeImage(file);
        added.push({
          id: crypto.randomUUID(),
          name: file.name || "Pasted image",
          blob,
          preview: URL.createObjectURL(blob),
          status: "queued",
          form: EMPTY_EVENT_FORM,
          flagged: new Set(),
          notes: null,
          error: null,
          attempts: 0,
        });
      } catch (err) {
        setNotice(`Couldn't open ${file.name || "an image"}: ${errorMessage(err)}`);
      }
    }
    setItems((list) => [...list, ...added]);
  }, []);

  // The reading queue: one poster at a time to stay inside Gemini's free limits.
  useEffect(() => {
    if (busy.current) return;
    if (pausedUntil && pausedUntil > Date.now()) return;
    const next = items.find((it) => it.status === "queued");
    if (!next) return;
    busy.current = true;
    update(next.id, { status: "reading", error: null });
    readPoster(next.blob)
      .then(({ fields, notes }) => update(next.id, applyReading(next, fields, notes)))
      .catch((err: unknown) => {
        const status = err instanceof ReadError ? err.status : 0;
        if (status === 429 && next.attempts < MAX_RATE_LIMIT_RETRIES) {
          // Free-tier limit: wait, then try this poster again.
          update(next.id, { status: "queued", attempts: next.attempts + 1 });
          setPausedUntil(Date.now() + RATE_LIMIT_PAUSE_MS);
        } else {
          update(next.id, { status: "failed", error: errorMessage(err) });
        }
      })
      .finally(() => {
        busy.current = false;
        setNow(Date.now()); // nudge the effect to pick up the next poster
      });
  }, [items, pausedUntil, now, update]);

  // Countdown while paused for the rate limit.
  useEffect(() => {
    if (!pausedUntil) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= pausedUntil) setPausedUntil(null);
    }, 1000);
    return () => clearInterval(timer);
  }, [pausedUntil]);

  // Don't lose a batch by closing the tab.
  const unpublished = items.filter((it) => it.status !== "published" && it.status !== "no-event").length;
  useEffect(() => {
    if (!unpublished) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unpublished]);

  const issuesById = useMemo(
    () => new Map(items.map((it) => [it.id, itemIssues(it, existingEvents, items)])),
    [items, existingEvents],
  );

  async function publishItem(id: string): Promise<boolean> {
    const item = itemsRef.current.find((it) => it.id === id);
    if (!item) return false;
    const built = buildEventInput(item.form);
    if ("error" in built) {
      update(id, { error: built.error });
      setOpenId(id);
      return false;
    }
    update(id, { status: "publishing", error: null });
    try {
      const imageUrl = await uploadPoster(item.blob);
      await publishEvent({ ...built.input, image_url: imageUrl });
      update(id, { status: "published" });
      if (openId === id) setOpenId(null);
      return true;
    } catch (err) {
      update(id, { status: "ready", error: errorMessage(err, "Publishing failed") });
      return false;
    }
  }

  async function publishAllReady() {
    const ready = itemsRef.current.filter((it) => isReadyToPublish(it, issuesById.get(it.id)!));
    if (!ready.length) return;
    setPublishingAll(true);
    let ok = 0;
    for (const it of ready) if (await publishItem(it.id)) ok++;
    setPublishingAll(false);
    setNotice(`Published ${ok} of ${ready.length}. ${ready.length - ok ? "Check the ones that failed." : ""}`);
    onPublished();
  }

  function remove(id: string) {
    const item = itemsRef.current.find((it) => it.id === id);
    if (item) URL.revokeObjectURL(item.preview);
    setItems((list) => list.filter((it) => it.id !== id));
    if (openId === id) setOpenId(null);
  }

  function clearFinished() {
    itemsRef.current
      .filter((it) => it.status === "published" || it.status === "no-event")
      .forEach((it) => URL.revokeObjectURL(it.preview));
    setItems((list) => list.filter((it) => it.status !== "published" && it.status !== "no-event"));
  }

  const counts = {
    reading: items.filter((it) => it.status === "queued" || it.status === "reading").length,
    read: items.filter((it) => it.status !== "queued" && it.status !== "reading").length,
    readyToPublish: items.filter((it) => isReadyToPublish(it, issuesById.get(it.id)!)).length,
    finished: items.filter((it) => it.status === "published" || it.status === "no-event").length,
  };
  const secondsLeft = pausedUntil ? Math.max(0, Math.ceil((pausedUntil - now) / 1000)) : 0;

  return (
    <section className="space-y-4 border-4 border-black bg-white p-4 shadow-brutal-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-xl uppercase">
          <Sparkles className="h-5 w-5" /> Add events from posters
        </h2>
        {items.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={publishAllReady}
              disabled={!counts.readyToPublish || publishingAll}
              className="brutal-btn bg-durbs-pink !py-1.5 !text-xs text-white"
            >
              {publishingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Publish all ready ({counts.readyToPublish})
            </button>
            {counts.finished > 0 && (
              <button type="button" onClick={clearFinished} className="brutal-btn bg-white !py-1.5 !text-xs">
                <X className="h-4 w-4" /> Clear finished
              </button>
            )}
          </div>
        )}
      </div>

      <PosterDropZone
        onFiles={addFiles}
        listenForPaste
        title="Drop posters here, paste them, or"
        hint={`Up to ${MAX_BATCH} at a time, e.g. screenshots of Instagram posters. The AI reads each one; you check and publish.`}
      />

      {notice && <p className="border-3 border-black bg-durbs-yellow px-3 py-2 text-sm font-bold">{notice}</p>}

      {items.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
          {counts.reading > 0 ? (
            secondsLeft > 0 ? (
              <>
                <Clock className="h-4 w-4" /> Gemini&apos;s free limit reached, continuing in {secondsLeft}s… (
                {counts.read} of {items.length} read)
              </>
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Reading {counts.read + 1} of {items.length}…
              </>
            )
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" /> All {items.length} read.
              {counts.readyToPublish < items.length - counts.finished &&
                " Posters marked “Check details” or with warnings need a look before publishing."}
            </>
          )}
        </p>
      )}

      {items.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((item) => {
            const issues = issuesById.get(item.id)!;
            const open = openId === item.id;
            const style = STATUS_STYLE[item.status];
            const startDate = fromSastLocalInput(item.form.start_date);
            const editable = !["queued", "reading", "publishing", "published"].includes(item.status);
            return (
              <li
                key={item.id}
                className={`border-3 border-black bg-white shadow-brutal ${open ? "md:col-span-2" : ""} ${
                  item.status === "published" ? "opacity-60" : ""
                }`}
              >
                <div className="flex gap-3 p-3">
                  <img src={item.preview} alt="" className="h-28 w-20 shrink-0 border-2 border-black object-cover" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <span className={`brutal-badge ${style.className}`}>
                      {(item.status === "reading" || item.status === "publishing") && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      {style.label}
                    </span>
                    <p className="truncate font-display text-sm uppercase">{item.form.title || item.name}</p>
                    {startDate && (
                      <p className="text-xs font-bold">
                        {formatEventDate({ start_date: startDate.toISOString(), end_date: null } as DurbsEvent)}
                        {item.form.venue_name && ` · ${item.form.venue_name}`}
                      </p>
                    )}
                    {item.status === "no-event" && (
                      <p className="text-xs font-semibold text-neutral-600">
                        This doesn&apos;t look like an event poster. Remove it, or fill it in by hand.
                      </p>
                    )}
                    {item.error && <p className="text-xs font-bold text-red-600">{item.error}</p>}
                    {item.status !== "published" && issues.unchecked.length > 0 && editable && (
                      <p className="text-xs font-bold text-neutral-700">Check: {issues.unchecked.join(", ").replace(/_/g, " ")}</p>
                    )}
                    {item.status !== "published" && issues.duplicates.length > 0 && (
                      <p className="flex items-start gap-1 text-xs font-black text-durbs-pink">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Possible duplicate of{" "}
                        {issues.duplicates.slice(0, 2).map((t) => `“${t}”`).join(", ")}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {editable && (
                        <button
                          type="button"
                          onClick={() => setOpenId(open ? null : item.id)}
                          aria-expanded={open}
                          className="brutal-btn bg-white !px-2 !py-1 !text-xs"
                        >
                          <Pencil className="h-3.5 w-3.5" /> {open ? "Close" : "Edit"}
                        </button>
                      )}
                      {editable && item.status !== "no-event" && (
                        <button
                          type="button"
                          onClick={() => {
                            void publishItem(item.id).then((ok) => ok && onPublished());
                          }}
                          className="brutal-btn bg-durbs-pink !px-2 !py-1 !text-xs text-white"
                        >
                          <Send className="h-3.5 w-3.5" /> Publish
                        </button>
                      )}
                      {item.status === "failed" && (
                        <button
                          type="button"
                          onClick={() => update(item.id, { status: "queued", error: null, attempts: 0 })}
                          className="brutal-btn bg-white !px-2 !py-1 !text-xs"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Retry
                        </button>
                      )}
                      {item.status !== "reading" && item.status !== "publishing" && (
                        <button
                          type="button"
                          onClick={() => remove(item.id)}
                          aria-label={`Remove ${item.form.title || item.name}`}
                          className="brutal-btn bg-white !px-2 !py-1 !text-xs"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {open && editable && (
                  <div className="space-y-3 border-t-3 border-black p-3">
                    {item.notes && (
                      <p className="border-2 border-black bg-durbs-yellow px-2 py-1 text-xs font-bold">AI note: {item.notes}</p>
                    )}
                    <div className="grid gap-4 md:grid-cols-[minmax(0,220px)_1fr]">
                      <img src={item.preview} alt="Poster" className="w-full border-3 border-black" />
                      <EventFormFields
                        form={item.form}
                        flagged={item.flagged}
                        hideImageUrl
                        onChange={(form) => setItems((list) => list.map((it) => (it.id === item.id ? { ...it, ...editForm(it, form), error: null } : it)))}
                      />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

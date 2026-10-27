"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Send, Sparkles, X } from "lucide-react";
import EventFormFields, {
  EMPTY_EVENT_FORM,
  buildEventInput,
  type EventFormKey,
  type EventFormState,
} from "./EventForm";
import PosterDropZone from "./PosterDropZone";
import type { DurbsEvent } from "@/types/event";
import { publishEvent, supabase, uploadPoster } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { usePosterReader } from "@/lib/usePosterReader";
import { findLikelyDuplicates } from "@/lib/duplicates";
import { fromSastLocalInput } from "@/lib/time";
import { formatEventDate } from "@/lib/filters";

async function adminToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

interface PosterImportProps {
  onPublished: () => void;
  /** Events already on the site, to warn about duplicates before publishing. */
  existingEvents?: DurbsEvent[];
}

export default function PosterImport({ onPublished, existingEvents = [] }: PosterImportProps) {
  const reader = usePosterReader(adminToken);
  const [form, setForm] = useState<EventFormState>(EMPTY_EVENT_FORM);
  const [flagged, setFlagged] = useState<Set<EventFormKey>>(new Set());
  const [publishing, setPublishing] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const { read } = reader;
  const reviewing = reader.stage === "ready" && Boolean(reader.blob);

  const reset = () => {
    reader.reset();
    setForm(EMPTY_EVENT_FORM);
    setFlagged(new Set());
  };

  const handleFile = useCallback(
    async (file: File) => {
      setSuccess(null);
      const result = await read(file);
      setForm(result?.form ?? EMPTY_EVENT_FORM);
      setFlagged(result?.flagged ?? new Set());
    },
    [read],
  );

  const duplicates = useMemo(() => {
    const start = fromSastLocalInput(form.start_date);
    if (!form.title.trim() || !start) return [];
    const end = form.end_date ? fromSastLocalInput(form.end_date) : null;
    return findLikelyDuplicates(
      { title: form.title, start_date: start.toISOString(), end_date: end?.toISOString() ?? null },
      existingEvents.filter((e) => !e.denied_at),
    );
  }, [form.title, form.start_date, form.end_date, existingEvents]);

  async function publish() {
    if (!reader.blob) return;
    reader.setError(null);
    const built = buildEventInput(form);
    if ("error" in built) {
      reader.setError(built.error);
      return;
    }
    setPublishing(true);
    try {
      const imageUrl = await uploadPoster(reader.blob);
      await publishEvent({ ...built.input, image_url: imageUrl });
      setSuccess(`"${built.input.title}" is live.`);
      reset();
      onPublished();
    } catch (err) {
      reader.setError(errorMessage(err, "Publishing failed"));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <section className="space-y-4 border-4 border-black bg-white p-4 shadow-brutal-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-xl uppercase">
          <Sparkles className="h-5 w-5" /> Add event from poster
        </h2>
        {reviewing && (
          <button type="button" onClick={reset} className="brutal-btn bg-white !py-1 !text-xs">
            <X className="h-3.5 w-3.5" /> Discard
          </button>
        )}
      </div>

      {success && <p className="border-3 border-black bg-green-400 px-3 py-2 text-sm font-bold">{success}</p>}
      {reader.error && (
        <p role="alert" className="border-3 border-black bg-red-500 px-3 py-2 text-sm font-bold text-white">
          {reader.error}
        </p>
      )}

      {reader.stage === "idle" && (
        <PosterDropZone
          onFile={handleFile}
          listenForPaste
          hint="One poster per image. The AI fills in the details for you to check before publishing."
        />
      )}

      {reader.stage === "reading" && (
        <div className="flex items-center gap-3 border-3 border-black bg-durbs-cyan p-6 font-display uppercase">
          <Loader2 className="h-6 w-6 animate-spin" /> Reading poster…
        </div>
      )}

      {reviewing && (
        <div className="grid gap-6 md:grid-cols-[minmax(0,280px)_1fr]">
          <div className="space-y-2">
            {reader.preview && (
              <img src={reader.preview} alt="Poster" className="w-full border-3 border-black shadow-brutal" />
            )}
            <p className="text-xs font-semibold text-neutral-600">This poster becomes the event image.</p>
          </div>
          <div className="space-y-4">
            {reader.model && (
              <p className="text-xs font-bold text-neutral-600">
                Read by {reader.model}. Check every field before publishing.
              </p>
            )}
            {reader.notes && (
              <p className="border-3 border-black bg-durbs-yellow px-3 py-2 text-sm font-bold">AI note: {reader.notes}</p>
            )}
            {flagged.size > 0 && (
              <p className="text-sm font-bold">Highlighted fields weren&apos;t clear on the poster. Please check them.</p>
            )}
            <EventFormFields form={form} onChange={setForm} flagged={flagged} hideImageUrl />
            {duplicates.length > 0 && (
              <div className="flex gap-2 border-3 border-black bg-durbs-yellow px-3 py-2 text-sm font-bold">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <div>
                  This looks like an event that&apos;s already listed:
                  <ul className="mt-1 list-disc pl-5 font-semibold">
                    {duplicates.slice(0, 3).map((d) => (
                      <li key={d.id}>
                        {d.title} · {formatEventDate(d)}
                        {!d.is_approved && " (pending)"}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={publish}
              disabled={publishing}
              className="brutal-btn w-full bg-durbs-pink py-3 text-base text-white"
            >
              {publishing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Publishing…
                </>
              ) : (
                <>
                  {duplicates.length ? "Publish anyway" : "Publish event"} <Send className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

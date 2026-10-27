"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Send, Sparkles, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import EventFormFields, {
  EMPTY_EVENT_FORM,
  buildEventInput,
  type EventFormKey,
  type EventFormState,
} from "@/components/EventForm";
import PosterDropZone from "@/components/PosterDropZone";
import { isSupabaseConfigured, submitEvent, uploadPoster } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { blobToBase64 } from "@/lib/images";
import { usePosterReader } from "@/lib/usePosterReader";

/** Store the organiser's poster (rate-limited server upload) and return its URL. */
async function uploadSubmissionPoster(blob: Blob): Promise<string> {
  if (!isSupabaseConfigured) return uploadPoster(blob); // demo mode: local object URL
  const res = await fetch("/api/upload-poster", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: await blobToBase64(blob) }),
  });
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !body.url) throw new Error(body.error || `Uploading the poster failed (${res.status}).`);
  return body.url;
}

export default function SubmitPage() {
  const [form, setForm] = useState<EventFormState>(EMPTY_EVENT_FORM);
  const [flagged, setFlagged] = useState<Set<EventFormKey>>(new Set());
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const poster = usePosterReader();
  const { read } = poster;

  const handlePoster = useCallback(
    async (file: File) => {
      const result = await read(file);
      if (result) {
        // Keep anything the organiser already typed; fill the gaps from the poster.
        setForm((current) => {
          const merged = { ...result.form };
          (Object.keys(current) as EventFormKey[]).forEach((key) => {
            if (current[key] && current[key] !== EMPTY_EVENT_FORM[key]) {
              (merged as Record<EventFormKey, string>)[key] = current[key];
            }
          });
          return merged;
        });
        setFlagged(result.flagged);
      }
    },
    [read],
  );

  const removePoster = () => {
    poster.reset();
    setFlagged(new Set());
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const built = buildEventInput(form);
    if ("error" in built) {
      setError(built.error);
      return;
    }
    setStatus("submitting");
    try {
      const input = { ...built.input };
      if (poster.blob) input.image_url = await uploadSubmissionPoster(poster.blob);
      await submitEvent(input);
      setStatus("done");
      setForm(EMPTY_EVENT_FORM);
      setFlagged(new Set());
      poster.reset();
    } catch (err) {
      setStatus("error");
      setError(errorMessage(err, "Something went wrong. Try again?"));
    }
  }

  return (
    <>
      <Navbar compact />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8 space-y-3">
          <span className="brutal-badge bg-durbs-cyan">For organisers</span>
          <h1 className="font-display text-4xl uppercase leading-none sm:text-5xl">
            Put your event on the <span className="bg-durbs-yellow px-2">Durbs</span> map
          </h1>
          <p className="font-semibold">
            Free to list. Every submission is reviewed by our team before it goes live — usually
            within 24 hours.
          </p>
          {!isSupabaseConfigured && (
            <p className="border-3 border-black bg-durbs-purple px-3 py-2 text-sm font-bold text-white shadow-brutal">
              Demo mode: submissions are kept in memory for this session only (visit /admin to see
              them).
            </p>
          )}
        </div>

        {status === "done" ? (
          <div className="space-y-4 border-4 border-black bg-durbs-cyan p-8 text-center shadow-brutal-xl">
            <CheckCircle2 className="mx-auto h-12 w-12" strokeWidth={2.5} />
            <h2 className="font-display text-3xl uppercase">Lekker! Submitted.</h2>
            <p className="font-semibold">
              Your event is in the moderation queue. Once approved it&apos;ll show up on the map.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => setStatus("idle")} className="brutal-btn bg-white">
                Submit another
              </button>
              <Link href="/" className="brutal-btn bg-durbs-pink text-white">
                Back to events
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="space-y-3 border-4 border-black bg-white p-4 shadow-brutal-lg">
              <h2 className="flex items-center gap-2 font-display text-lg uppercase">
                <Sparkles className="h-5 w-5" /> Got a poster? Let us fill in the form
              </h2>
              {poster.stage === "idle" && !poster.blob && (
                <PosterDropZone
                  onFile={handlePoster}
                  title="Drop your poster here, or"
                  hint="We'll read the details off it. Check them before you submit. The poster becomes your event image."
                />
              )}
              {poster.stage === "reading" && (
                <div className="flex items-center gap-3 border-3 border-black bg-durbs-cyan p-4 font-display uppercase">
                  <Loader2 className="h-6 w-6 animate-spin" /> Reading your poster…
                </div>
              )}
              {poster.error && (
                <p role="status" className="border-3 border-black bg-durbs-yellow px-3 py-2 text-sm font-bold">
                  {poster.error}
                </p>
              )}
              {poster.preview && poster.stage === "ready" && (
                <div className="flex items-start gap-4">
                  <img src={poster.preview} alt="Your poster" className="w-28 border-3 border-black sm:w-36" />
                  <div className="space-y-2 text-sm font-bold">
                    <p>{poster.error ? "Poster attached." : "Done! Check the details below."}</p>
                    {flagged.size > 0 && <p>Highlighted fields weren&apos;t clear on the poster.</p>}
                    <button type="button" onClick={removePoster} className="brutal-btn bg-white !py-1 !text-xs">
                      <X className="h-3.5 w-3.5" /> Remove poster
                    </button>
                  </div>
                </div>
              )}
            </section>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 border-4 border-black bg-white p-6 shadow-brutal-xl"
            >
              <EventFormFields form={form} onChange={setForm} flagged={flagged} hideImageUrl={Boolean(poster.blob)} />

              {error && (
                <p role="alert" className="border-3 border-black bg-red-500 px-3 py-2 font-bold text-white">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "submitting" || poster.stage === "reading"}
                className="brutal-btn w-full bg-durbs-pink py-3 text-base text-white"
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    Submit for review <Send className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </main>
    </>
  );
}

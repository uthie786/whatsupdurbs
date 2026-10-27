"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { ImagePlus, Loader2, Send, Sparkles, X } from "lucide-react";
import EventFormFields, {
  EMPTY_EVENT_FORM,
  buildEventInput,
  type EventFormKey,
  type EventFormState,
} from "./EventForm";
import { publishEvent, supabase, uploadPoster } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import type { PosterFields } from "@/lib/gemini";

const MAX_SIDE = 1600;

/** Shrink to at most 1600px on the longest side and re-encode as JPEG. */
async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't process the image.");
  ctx.fillStyle = "#ffffff"; // flatten transparent PNGs
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't encode the image."))), "image/jpeg", 0.85),
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Fill the form from the AI's reading and flag anything it couldn't read. */
function formFromFields(f: PosterFields): { form: EventFormState; flagged: Set<EventFormKey> } {
  const flagged = new Set<EventFormKey>();
  const pick = <K extends EventFormKey>(key: K, value: EventFormState[K] | null, required = false) => {
    if (value === null || value === "") {
      if (required) flagged.add(key);
      return EMPTY_EVENT_FORM[key];
    }
    return value;
  };
  const form: EventFormState = {
    ...EMPTY_EVENT_FORM,
    title: pick("title", f.title, true),
    description: pick("description", f.description, true),
    category: pick("category", f.category, true),
    venue_name: pick("venue_name", f.venue_name, true),
    address: pick("address", f.address),
    area: pick("area", f.area, true),
    start_date: pick("start_date", f.start_local, true),
    end_date: pick("end_date", f.end_local),
    price_text: pick("price_text", f.price_text),
    ticket_url: pick("ticket_url", f.ticket_url),
  };
  // A midnight start usually means the poster had no time on it.
  if (form.start_date.endsWith("T00:00")) flagged.add("start_date");
  return { form, flagged };
}

type Stage = "idle" | "reading" | "review" | "publishing";

export default function PosterImport({ onPublished }: { onPublished: () => void }) {
  const [stage, setStage] = useState<Stage>("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [form, setForm] = useState<EventFormState>(EMPTY_EVENT_FORM);
  const [flagged, setFlagged] = useState<Set<EventFormKey>>(new Set());
  const [notes, setNotes] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const reset = () => {
    setStage("idle");
    setBlob(null);
    setPreview(null);
    setForm(EMPTY_EVENT_FORM);
    setFlagged(new Set());
    setNotes(null);
    setError(null);
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("That isn't an image. Use a JPEG, PNG or WebP poster.");
      return;
    }
    setError(null);
    setSuccess(null);
    setNotes(null);
    setStage("reading");
    let resized: Blob;
    try {
      resized = await resizeImage(file);
    } catch (err) {
      setError(errorMessage(err, "Couldn't open that image."));
      setStage("idle");
      return;
    }
    setBlob(resized);
    setPreview(URL.createObjectURL(resized));

    try {
      if (!supabase) throw new Error("Demo mode: AI reading needs Supabase and a Gemini key.");
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session expired, please sign in again.");
      const res = await fetch("/api/extract-poster", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageBase64: await blobToBase64(resized), mimeType: "image/jpeg" }),
      });
      const body = (await res.json().catch(() => ({}))) as { fields?: PosterFields; notes?: string | null; error?: string };
      if (!res.ok || !body.fields) throw new Error(body.error || `Reading the poster failed (${res.status}).`);
      const filled = formFromFields(body.fields);
      setForm(filled.form);
      setFlagged(filled.flagged);
      setNotes(body.notes ?? null);
    } catch (err) {
      // Still let the admin enter the details by hand, with the poster attached.
      setError(`${errorMessage(err)} You can still fill in the details below.`);
      setForm(EMPTY_EVENT_FORM);
      setFlagged(new Set());
    }
    setStage("review");
  }, []);

  // Paste a poster from the clipboard anywhere on the admin page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (stage !== "idle") return;
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (file) {
        e.preventDefault();
        void handleFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [stage, handleFile]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  async function publish() {
    if (!blob) return;
    setError(null);
    const built = buildEventInput(form);
    if ("error" in built) {
      setError(built.error);
      return;
    }
    setStage("publishing");
    try {
      const imageUrl = await uploadPoster(blob);
      await publishEvent({ ...built.input, image_url: imageUrl });
      setSuccess(`"${built.input.title}" is live.`);
      reset();
      onPublished();
    } catch (err) {
      setError(errorMessage(err, "Publishing failed"));
      setStage("review");
    }
  }

  return (
    <section className="space-y-4 border-4 border-black bg-white p-4 shadow-brutal-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-xl uppercase">
          <Sparkles className="h-5 w-5" /> Add event from poster
        </h2>
        {stage === "review" && (
          <button type="button" onClick={reset} className="brutal-btn bg-white !py-1 !text-xs">
            <X className="h-3.5 w-3.5" /> Discard
          </button>
        )}
      </div>

      {success && (
        <p className="border-3 border-black bg-green-400 px-3 py-2 text-sm font-bold">{success}</p>
      )}
      {error && (
        <p role="alert" className="border-3 border-black bg-red-500 px-3 py-2 text-sm font-bold text-white">
          {error}
        </p>
      )}

      {stage === "idle" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-3 border-4 border-dashed border-black p-8 text-center transition-colors ${
            dragging ? "bg-durbs-cyan" : "bg-durbs-yellow/30"
          }`}
        >
          <ImagePlus className="h-10 w-10" />
          <p className="font-display uppercase">Drop a poster here, paste it, or</p>
          <button type="button" onClick={() => fileInput.current?.click()} className="brutal-btn bg-durbs-pink text-white">
            Choose image
          </button>
          <p className="text-xs font-semibold text-neutral-600">
            One poster per image. The AI fills in the details for you to check before publishing.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handleFile(file);
            }}
          />
        </div>
      )}

      {stage === "reading" && (
        <div className="flex items-center gap-3 border-3 border-black bg-durbs-cyan p-6 font-display uppercase">
          <Loader2 className="h-6 w-6 animate-spin" /> Reading poster…
        </div>
      )}

      {(stage === "review" || stage === "publishing") && (
        <div className="grid gap-6 md:grid-cols-[minmax(0,280px)_1fr]">
          <div className="space-y-2">
            {preview && (
              <img src={preview} alt="Poster" className="w-full border-3 border-black shadow-brutal" />
            )}
            <p className="text-xs font-semibold text-neutral-600">This poster becomes the event image.</p>
          </div>
          <div className="space-y-4">
            {notes && (
              <p className="border-3 border-black bg-durbs-yellow px-3 py-2 text-sm font-bold">AI note: {notes}</p>
            )}
            {flagged.size > 0 && (
              <p className="text-sm font-bold">
                Highlighted fields weren&apos;t clear on the poster. Please check them.
              </p>
            )}
            <EventFormFields form={form} onChange={setForm} flagged={flagged} hideImageUrl />
            <button
              type="button"
              onClick={publish}
              disabled={stage === "publishing"}
              className="brutal-btn w-full bg-durbs-pink py-3 text-base text-white"
            >
              {stage === "publishing" ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Publishing…
                </>
              ) : (
                <>
                  Publish event <Send className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

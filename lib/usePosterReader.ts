"use client";

import { useCallback, useEffect, useState } from "react";
import { EMPTY_EVENT_FORM, type EventFormKey, type EventFormState } from "@/components/EventForm";
import { blobToBase64, resizeImage } from "@/lib/images";
import { errorMessage } from "@/lib/errors";
import type { PosterFields } from "@/lib/gemini";

/** Fill the form from the AI's reading and flag anything it couldn't read. */
export function formFromFields(f: PosterFields): { form: EventFormState; flagged: Set<EventFormKey> } {
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

export type PosterReaderStage = "idle" | "reading" | "ready";

export interface PosterReading {
  form: EventFormState;
  flagged: Set<EventFormKey>;
}

/**
 * Resize a poster image and ask the server to read it. Used by the admin
 * importer (signed-in token) and the public submit form (rate-limited).
 */
export function usePosterReader(getToken?: () => Promise<string | null>) {
  const [stage, setStage] = useState<PosterReaderStage>("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const reset = useCallback(() => {
    setStage("idle");
    setBlob(null);
    setPreview(null);
    setError(null);
    setNotes(null);
    setModel(null);
  }, []);

  /** Returns the pre-filled form, or null if reading failed (the poster is still kept). */
  const read = useCallback(
    async (file: File): Promise<PosterReading | null> => {
      if (!file.type.startsWith("image/")) {
        setError("That isn't an image. Use a JPEG, PNG or WebP poster.");
        return null;
      }
      setError(null);
      setNotes(null);
      setModel(null);
      setStage("reading");
      let resized: Blob;
      try {
        resized = await resizeImage(file);
      } catch (err) {
        setError(errorMessage(err, "Couldn't open that image."));
        setStage("idle");
        return null;
      }
      setBlob(resized);
      setPreview(URL.createObjectURL(resized));

      try {
        const token = getToken ? await getToken() : null;
        const res = await fetch("/api/extract-poster", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ imageBase64: await blobToBase64(resized), mimeType: "image/jpeg" }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          fields?: PosterFields;
          notes?: string | null;
          model?: string;
          error?: string;
        };
        if (!res.ok || !body.fields) throw new Error(body.error || `Reading the poster failed (${res.status}).`);
        setNotes(body.notes ?? null);
        setModel(body.model ?? null);
        setStage("ready");
        return formFromFields(body.fields);
      } catch (err) {
        setError(`${errorMessage(err)} You can still fill in the details by hand.`);
        setStage("ready");
        return null;
      }
    },
    [getToken],
  );

  return { stage, blob, preview, error, notes, model, read, reset, setError };
}

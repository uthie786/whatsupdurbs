"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Save, X } from "lucide-react";
import type { DurbsEvent } from "@/types/event";
import EventFormFields, { buildEventInput, eventToForm, type EventFormState } from "./EventForm";
import { updateEventDetails, uploadPoster, type EventDetailsPatch } from "@/lib/supabase";
import { resizeImage } from "@/lib/images";
import { errorMessage } from "@/lib/errors";

interface EditEventPanelProps {
  event: DurbsEvent;
  onSaved: (patch: EventDetailsPatch) => void;
  onCancel: () => void;
}

/** Inline editor for an existing event, including swapping its poster. */
export default function EditEventPanel({ event, onSaved, onCancel }: EditEventPanelProps) {
  const [form, setForm] = useState<EventFormState>(() => eventToForm(event));
  const [newPoster, setNewPoster] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function pickPoster(file: File) {
    setError(null);
    try {
      const resized = await resizeImage(file);
      setNewPoster(resized);
      setPreview(URL.createObjectURL(resized));
    } catch (err) {
      setError(errorMessage(err, "Couldn't open that image."));
    }
  }

  async function save() {
    setError(null);
    const built = buildEventInput(form);
    if ("error" in built) {
      setError(built.error);
      return;
    }
    // Keep the slug so shared links still work.
    const { slug: _slug, ...input } = built.input;
    void _slug;
    const patch: EventDetailsPatch = { ...input };
    // Keep the exact venue position unless the area changed (form positions use area centres).
    if (form.area === event.area) {
      patch.latitude = event.latitude;
      patch.longitude = event.longitude;
    }
    setSaving(true);
    try {
      if (newPoster) patch.image_url = await uploadPoster(newPoster);
      await updateEventDetails(event.id, patch);
      onSaved(patch);
    } catch (err) {
      setError(errorMessage(err, "Saving failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 border-t-3 border-black pt-4 sm:col-span-3">
      {error && (
        <p role="alert" className="border-3 border-black bg-red-500 px-3 py-2 text-sm font-bold text-white">
          {error}
        </p>
      )}
      <div className="grid gap-6 md:grid-cols-[minmax(0,200px)_1fr]">
        <div className="space-y-2">
          {(preview || form.image_url) && (
            <img src={preview ?? form.image_url} alt="" className="w-full border-3 border-black" />
          )}
          <button type="button" onClick={() => fileInput.current?.click()} className="brutal-btn w-full bg-white !text-xs">
            <ImagePlus className="h-4 w-4" /> {form.image_url || preview ? "Replace poster" : "Add poster"}
          </button>
          {newPoster && <p className="text-xs font-bold">New poster will upload when you save.</p>}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void pickPoster(file);
            }}
          />
        </div>
        <div className="space-y-4">
          <EventFormFields form={form} onChange={setForm} hideImageUrl={Boolean(newPoster)} />
          {event.source === "quicket" && (
            <p className="text-xs font-bold text-neutral-600">
              After you save, the Quicket sync stops updating this event so your changes stick.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={saving} className="brutal-btn bg-durbs-pink text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
            </button>
            <button type="button" onClick={onCancel} disabled={saving} className="brutal-btn bg-white">
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

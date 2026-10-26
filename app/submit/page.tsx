"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import Navbar from "@/components/Navbar";
import { DURBAN_AREAS, EVENT_CATEGORIES, type DurbanArea, type EventCategory } from "@/types/event";
import { AREA_COORDS } from "@/lib/areas";
import { isSupabaseConfigured, submitEvent } from "@/lib/supabase";
import { slugify } from "@/lib/filters";

interface FormState {
  title: string;
  category: EventCategory;
  start_date: string;
  end_date: string;
  venue_name: string;
  address: string;
  area: DurbanArea;
  price_text: string;
  image_url: string;
  ticket_url: string;
  description: string;
}

const EMPTY: FormState = {
  title: "",
  category: "Markets",
  start_date: "",
  end_date: "",
  venue_name: "",
  address: "",
  area: "Umhlanga",
  price_text: "",
  image_url: "",
  ticket_url: "",
  description: "",
};

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="font-display text-sm uppercase">
        {label} {required && <span className="text-durbs-pink">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs font-semibold text-neutral-600">{hint}</span>}
    </label>
  );
}

export default function SubmitPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const set =
    <K extends keyof FormState>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value as FormState[K] }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const start = new Date(form.start_date);
    const end = form.end_date ? new Date(form.end_date) : null;
    if (Number.isNaN(start.getTime())) {
      setError("Please add a valid start date.");
      return;
    }
    if (end && end < start) {
      setError("End date can't be before the start date.");
      return;
    }

    setStatus("submitting");
    const [latitude, longitude] = AREA_COORDS[form.area];
    try {
      await submitEvent({
        title: form.title.trim(),
        slug: `${slugify(form.title)}-${Date.now().toString(36)}`,
        description: form.description.trim(),
        category: form.category,
        venue_name: form.venue_name.trim(),
        address: form.address.trim(),
        area: form.area,
        latitude,
        longitude,
        start_date: start.toISOString(),
        end_date: end ? end.toISOString() : null,
        image_url: form.image_url.trim() || null,
        ticket_url: form.ticket_url.trim() || null,
        price_text: form.price_text.trim() || null,
      });
      setStatus("done");
      setForm(EMPTY);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong. Try again?");
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
          <form
            onSubmit={handleSubmit}
            className="space-y-5 border-4 border-black bg-white p-6 shadow-brutal-xl"
          >
            <Field label="Event title" required>
              <input
                required
                maxLength={120}
                value={form.title}
                onChange={set("title")}
                className="brutal-input"
                placeholder="e.g. Sunday Sundowner Market"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Category" required>
                <select value={form.category} onChange={set("category")} className="brutal-input">
                  {EVENT_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Area" required>
                <select value={form.area} onChange={set("area")} className="brutal-input">
                  {DURBAN_AREAS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </Field>
              <Field label="Starts" required>
                <input
                  required
                  type="datetime-local"
                  value={form.start_date}
                  onChange={set("start_date")}
                  className="brutal-input"
                />
              </Field>
              <Field label="Ends">
                <input
                  type="datetime-local"
                  value={form.end_date}
                  min={form.start_date || undefined}
                  onChange={set("end_date")}
                  className="brutal-input"
                />
              </Field>
              <Field label="Venue name" required>
                <input
                  required
                  value={form.venue_name}
                  onChange={set("venue_name")}
                  className="brutal-input"
                  placeholder="e.g. Moses Mabhida Stadium"
                />
              </Field>
              <Field label="Address">
                <input
                  value={form.address}
                  onChange={set("address")}
                  className="brutal-input"
                  placeholder="Street, suburb"
                />
              </Field>
              <Field label="Price" hint="e.g. Free, R150, From R250">
                <input value={form.price_text} onChange={set("price_text")} className="brutal-input" />
              </Field>
              <Field label="Ticket link">
                <input
                  type="url"
                  value={form.ticket_url}
                  onChange={set("ticket_url")}
                  className="brutal-input"
                  placeholder="https://"
                />
              </Field>
            </div>

            <Field label="Image URL" hint="A landscape photo or poster works best.">
              <input
                type="url"
                value={form.image_url}
                onChange={set("image_url")}
                className="brutal-input"
                placeholder="https://"
              />
            </Field>

            <Field label="Description" required>
              <textarea
                required
                rows={5}
                maxLength={1500}
                value={form.description}
                onChange={set("description")}
                className="brutal-input resize-y"
                placeholder="What's the vibe? Who's playing? Parking, kids, dogs?"
              />
            </Field>

            {error && (
              <p role="alert" className="border-3 border-black bg-red-500 px-3 py-2 font-bold text-white">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "submitting"}
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
        )}
      </main>
    </>
  );
}

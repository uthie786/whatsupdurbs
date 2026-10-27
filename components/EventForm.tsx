"use client";

import type { ReactNode } from "react";
import {
  DURBAN_AREAS,
  EVENT_CATEGORIES,
  type DurbanArea,
  type EventCategory,
  type NewEventInput,
} from "@/types/event";
import { AREA_COORDS } from "@/lib/areas";
import { slugify } from "@/lib/filters";
import { fromSastLocalInput, toSastLocalInput } from "@/lib/time";
import type { DurbsEvent } from "@/types/event";

export interface EventFormState {
  title: string;
  category: EventCategory;
  /** datetime-local value (YYYY-MM-DDTHH:mm), local time */
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

export type EventFormKey = keyof EventFormState;

export const EMPTY_EVENT_FORM: EventFormState = {
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

/** Pre-fill the form from an existing event (times shown in Durban time). */
export function eventToForm(event: DurbsEvent): EventFormState {
  return {
    title: event.title,
    category: event.category,
    start_date: toSastLocalInput(event.start_date),
    end_date: toSastLocalInput(event.end_date),
    venue_name: event.venue_name,
    address: event.address ?? "",
    area: event.area,
    price_text: event.price_text ?? "",
    image_url: event.image_url ?? "",
    ticket_url: event.ticket_url ?? "",
    description: event.description ?? "",
  };
}

/** Validate the form and turn it into an event row, or explain what's wrong. */
export function buildEventInput(
  form: EventFormState,
): { input: NewEventInput } | { error: string } {
  // Times are entered in Durban time, whatever timezone the browser is in.
  const start = fromSastLocalInput(form.start_date);
  const end = form.end_date ? fromSastLocalInput(form.end_date) : null;
  if (!form.title.trim()) return { error: "Please add a title." };
  if (!form.venue_name.trim()) return { error: "Please add a venue." };
  if (!start) return { error: "Please add a valid start date." };
  if (form.end_date && !end) return { error: "Please add a valid end date." };
  if (end && end < start) return { error: "End date can't be before the start date." };

  const [latitude, longitude] = AREA_COORDS[form.area];
  return {
    input: {
      title: form.title.trim(),
      slug: `${slugify(form.title) || "event"}-${Date.now().toString(36)}`,
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
    },
  };
}

function Field({
  label,
  required,
  hint,
  flagged,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  flagged?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`block space-y-1.5 ${flagged ? "bg-durbs-yellow/40 p-1.5 outline outline-2 outline-dashed outline-durbs-pink" : ""}`}>
      <span className="font-display text-sm uppercase">
        {label} {required && <span className="text-durbs-pink">*</span>}
        {flagged && <span className="ml-1 text-[10px] text-durbs-pink">check this</span>}
      </span>
      {children}
      {hint && <span className="block text-xs font-semibold text-neutral-600">{hint}</span>}
    </label>
  );
}

interface EventFormFieldsProps {
  form: EventFormState;
  onChange: (form: EventFormState) => void;
  /** Fields to highlight for review (e.g. ones the AI couldn't read). */
  flagged?: ReadonlySet<EventFormKey>;
  /** Hide the image URL field when the image comes from elsewhere. */
  hideImageUrl?: boolean;
}

/** The event fields shared by the public submit form and the admin poster import. */
export default function EventFormFields({
  form,
  onChange,
  flagged,
  hideImageUrl = false,
}: EventFormFieldsProps) {
  const set =
    <K extends EventFormKey>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      onChange({ ...form, [key]: e.target.value as EventFormState[K] });
  const f = (key: EventFormKey) => flagged?.has(key) ?? false;

  return (
    <div className="space-y-5">
      <Field label="Event title" required flagged={f("title")}>
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
        <Field label="Category" required flagged={f("category")}>
          <select value={form.category} onChange={set("category")} className="brutal-input">
            {EVENT_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Area" required flagged={f("area")}>
          <select value={form.area} onChange={set("area")} className="brutal-input">
            {DURBAN_AREAS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </Field>
        <Field label="Starts" required flagged={f("start_date")}>
          <input
            required
            type="datetime-local"
            value={form.start_date}
            onChange={set("start_date")}
            className="brutal-input"
          />
        </Field>
        <Field label="Ends" flagged={f("end_date")}>
          <input
            type="datetime-local"
            value={form.end_date}
            min={form.start_date || undefined}
            onChange={set("end_date")}
            className="brutal-input"
          />
        </Field>
        <Field label="Venue name" required flagged={f("venue_name")}>
          <input
            required
            value={form.venue_name}
            onChange={set("venue_name")}
            className="brutal-input"
            placeholder="e.g. Moses Mabhida Stadium"
          />
        </Field>
        <Field label="Address" flagged={f("address")}>
          <input
            value={form.address}
            onChange={set("address")}
            className="brutal-input"
            placeholder="Street, suburb"
          />
        </Field>
        <Field label="Price" hint="e.g. Free, R150, From R250" flagged={f("price_text")}>
          <input value={form.price_text} onChange={set("price_text")} className="brutal-input" />
        </Field>
        <Field label="Ticket link" flagged={f("ticket_url")}>
          <input
            type="url"
            value={form.ticket_url}
            onChange={set("ticket_url")}
            className="brutal-input"
            placeholder="https://"
          />
        </Field>
      </div>

      {!hideImageUrl && (
        <Field label="Image URL" hint="A landscape photo or poster works best.">
          <input
            type="url"
            value={form.image_url}
            onChange={set("image_url")}
            className="brutal-input"
            placeholder="https://"
          />
        </Field>
      )}

      <Field label="Description" required flagged={f("description")}>
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
    </div>
  );
}

// Decision logic for the admin bulk poster importer (kept free of React so it can be tested).
import type { DurbsEvent } from "@/types/event";
import { buildEventInput, type EventFormKey, type EventFormState } from "@/components/EventForm";
import { findLikelyDuplicates } from "@/lib/duplicates";
import { fromSastLocalInput } from "@/lib/time";
import type { PosterFields } from "@/lib/gemini";
import { formFromFields } from "@/lib/usePosterReader";

/** At most this many posters waiting in one batch. */
export const MAX_BATCH = 20;

export type BulkStatus =
  | "queued"
  | "reading"
  | "ready"
  | "needs-check"
  | "no-event"
  | "failed"
  | "publishing"
  | "published";

export interface BulkItem {
  id: string;
  name: string;
  blob: Blob;
  preview: string;
  status: BulkStatus;
  form: EventFormState;
  flagged: Set<EventFormKey>;
  notes: string | null;
  error: string | null;
  /** Times the reading was retried after a rate limit. */
  attempts: number;
}

const REQUIRED: EventFormKey[] = ["title", "description", "category", "venue_name", "area", "start_date"];

/** Status and form after the AI has read a poster. */
export function applyReading(
  item: BulkItem,
  fields: PosterFields,
  notes: string | null,
): Pick<BulkItem, "status" | "form" | "flagged" | "notes" | "error"> {
  if (!fields.title && !fields.start_local) {
    return { status: "no-event", form: item.form, flagged: new Set(), notes, error: null };
  }
  const { form, flagged } = formFromFields(fields);
  const needsCheck = REQUIRED.some((k) => flagged.has(k));
  return { status: needsCheck ? "needs-check" : "ready", form, flagged, notes, error: null };
}

/** After an edit, a field the admin changed no longer needs checking. */
export function editForm(item: BulkItem, form: EventFormState): Pick<BulkItem, "form" | "flagged" | "status"> {
  const flagged = new Set(item.flagged);
  (Object.keys(form) as EventFormKey[]).forEach((k) => {
    if (form[k] !== item.form[k]) flagged.delete(k);
  });
  const stillNeedsCheck = REQUIRED.some((k) => flagged.has(k)) || "error" in buildEventInput(form);
  const status =
    item.status === "needs-check" || item.status === "ready" || item.status === "no-event" || item.status === "failed"
      ? stillNeedsCheck
        ? "needs-check"
        : "ready"
      : item.status;
  return { form, flagged, status };
}

function asCandidate(item: BulkItem) {
  const start = fromSastLocalInput(item.form.start_date);
  if (!item.form.title.trim() || !start) return null;
  const end = item.form.end_date ? fromSastLocalInput(item.form.end_date) : null;
  return { id: item.id, title: item.form.title, start_date: start.toISOString(), end_date: end?.toISOString() ?? null };
}

export interface ItemIssues {
  /** Why it can't be published yet (validation message), or null. */
  invalid: string | null;
  /** Required fields the AI wasn't sure about and nobody has checked. */
  unchecked: EventFormKey[];
  /** Titles of events (on the site or in this batch) that look like the same event. */
  duplicates: string[];
}

export function itemIssues(item: BulkItem, existing: DurbsEvent[], batch: BulkItem[]): ItemIssues {
  const built = buildEventInput(item.form);
  const invalid = "error" in built ? built.error : null;
  const unchecked = REQUIRED.filter((k) => item.flagged.has(k));
  const me = asCandidate(item);
  const duplicates: string[] = [];
  if (me) {
    const live = existing.filter((e) => !e.denied_at);
    for (const d of findLikelyDuplicates(me, live)) duplicates.push(d.title);
    const others = batch
      .filter((b) => b.id !== item.id && b.status !== "published" && b.status !== "no-event")
      .map(asCandidate)
      .filter((c): c is NonNullable<typeof c> => c !== null);
    for (const d of findLikelyDuplicates(me, others)) duplicates.push(`${d.title} (in this batch)`);
  }
  return { invalid, unchecked, duplicates };
}

/** Safe for "Publish all ready": valid, nothing left to check, no duplicate warning. */
export function isReadyToPublish(item: BulkItem, issues: ItemIssues): boolean {
  return item.status === "ready" && !issues.invalid && issues.unchecked.length === 0 && issues.duplicates.length === 0;
}

// Server-only: reads event details off a poster image with Google's Gemini API
// (free tier via an AI Studio key). Plain REST, no SDK.
import { DURBAN_AREAS, EVENT_CATEGORIES, type DurbanArea, type EventCategory } from "@/types/event";

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-flash-latest";
const REQUEST_TIMEOUT_MS = 45_000;

export interface PosterFields {
  title: string | null;
  description: string | null;
  category: EventCategory | null;
  venue_name: string | null;
  address: string | null;
  area: DurbanArea | null;
  /** Local Durban time, YYYY-MM-DDTHH:mm */
  start_local: string | null;
  end_local: string | null;
  price_text: string | null;
  ticket_url: string | null;
}

export interface PosterExtraction {
  fields: PosterFields;
  notes: string | null;
  model: string;
}

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const nullableString = { type: "STRING", nullable: true };

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: nullableString,
    description: nullableString,
    category: { type: "STRING", nullable: true, enum: [...EVENT_CATEGORIES] },
    venue_name: nullableString,
    address: nullableString,
    area: { type: "STRING", nullable: true, enum: [...DURBAN_AREAS] },
    start_local: nullableString,
    end_local: nullableString,
    price_text: nullableString,
    ticket_url: nullableString,
    notes: nullableString,
  },
  required: [
    "title",
    "description",
    "category",
    "venue_name",
    "address",
    "area",
    "start_local",
    "end_local",
    "price_text",
    "ticket_url",
    "notes",
  ],
};

function buildPrompt(today: string): string {
  return `You read event posters for WhatsUpDurbs, a guide to events in Durban, South Africa.
Today is ${today} (Africa/Johannesburg, SAST). Extract the event shown on the poster.

Rules:
- Only use what the poster shows. Use null for anything not on the poster; never invent details.
- title: the event name as printed, in normal capitalisation.
- description: 1-2 short sentences in your own words about what the event is (performers, theme). No marketing hype.
- category: one of ${EVENT_CATEGORIES.join(", ")}. Concerts = live music/performances/shows, Markets = markets/expos/fairs/food, Popups = one-off pop-ups, workshops, sports and other events, Nightlife = parties/clubs/DJ nights, Festive = Christmas/New Year/December holiday events.
- area: the closest of ${DURBAN_AREAS.join(", ")} based on the venue, or null if you can't tell. Durban CBD, ICC, Playhouse and Suncoast count as Central Beachfront; uShaka and the Point precinct as Point Waterfront; Sibaya and Gateway as Umhlanga; Florida Road and Berea as Morningside.
- start_local / end_local: local time as YYYY-MM-DDTHH:mm. If the year isn't printed, use the next occurrence on or after today. If no time is printed, use T00:00 for start and null for end. Use the "doors open" time if no start time is given.
- price_text: short, e.g. "Free", "R150", "From R200", "R250 – R350".
- ticket_url: only a URL or ticketing site printed on the poster (e.g. "Quicket" alone is not a URL), otherwise null.
- notes: one short sentence about anything uncertain or unreadable, or null.`;
}

const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function cleanString(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

/** Validate Gemini's JSON so only known enum values and well-formed dates get through. */
export function parsePosterJson(raw: unknown): { fields: PosterFields; notes: string | null } {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const category = EVENT_CATEGORIES.find((c) => c === o.category) ?? null;
  const area = DURBAN_AREAS.find((a) => a === o.area) ?? null;
  const date = (v: unknown) => {
    const s = cleanString(v, 16);
    return s && DATETIME_RE.test(s) ? s : null;
  };
  const url = cleanString(o.ticket_url, 300);
  const ticketUrl = url && /^https?:\/\//i.test(url) ? url : url && /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(url) ? `https://${url}` : null;
  return {
    fields: {
      title: cleanString(o.title, 120),
      description: cleanString(o.description, 1500),
      category,
      venue_name: cleanString(o.venue_name, 200),
      address: cleanString(o.address, 300),
      area,
      start_local: date(o.start_local),
      end_local: date(o.end_local),
      price_text: cleanString(o.price_text, 80),
      ticket_url: ticketUrl,
    },
    notes: cleanString(o.notes, 500),
  };
}

function todayInDurban(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  }).format(now);
}

export async function extractPosterDetails(
  imageBase64: string,
  mimeType: string,
): Promise<PosterExtraction> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new GeminiError(
      "GEMINI_API_KEY isn't set. Create a free key at aistudio.google.com and add it in Vercel → Settings → Environment Variables, then redeploy.",
      500,
    );
  }
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  let res: Response;
  try {
    res = await fetch(`${GEMINI_API}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: buildPrompt(todayInDurban()) },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new GeminiError("The AI took too long to read the poster. Try again.", 504);
    }
    throw err;
  }

  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string; status?: string };
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  } | null;

  if (!res.ok) {
    const detail = body?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 429) {
      throw new GeminiError(`Gemini's free-tier limit was reached. Wait a minute and try again. (${detail})`, 429);
    }
    if (res.status === 404) {
      throw new GeminiError(`Gemini model "${model}" wasn't found. Set GEMINI_MODEL to a current Flash model. (${detail})`, 502);
    }
    if (res.status === 400 || res.status === 403) {
      throw new GeminiError(`Gemini rejected the request: ${detail}`, 502);
    }
    throw new GeminiError(`Gemini error: ${detail}`, 502);
  }

  if (body?.promptFeedback?.blockReason) {
    throw new GeminiError(`Gemini declined to read this image (${body.promptFeedback.blockReason}).`, 422);
  }
  const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new GeminiError("The AI's answer couldn't be read. Try again, or fill the form in by hand.", 502);
  }
  return { ...parsePosterJson(json), model };
}

// Server-only: reads event details off a poster image with Google's Gemini API
// (free tier via an AI Studio key). Plain REST, no SDK.
import { DURBAN_AREAS, EVENT_CATEGORIES, type DurbanArea, type EventCategory } from "@/types/event";
import { CATEGORY_INFO } from "@/lib/areas";

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-flash-latest";
/** Used when the main model is overloaded, missing or out of free quota. */
const DEFAULT_FALLBACK_MODEL = "gemini-flash-lite-latest";
/** Whole extraction, retries included, must finish inside the route's 60s limit. */
const TOTAL_BUDGET_MS = 50_000;
const MAX_ATTEMPT_MS = 30_000;

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
    /** Worth trying again (same or another model): overload, timeouts, server errors. */
    readonly retryable = false,
    /** Worth switching models: the model is missing or its free quota is used up. */
    readonly tryOtherModel = false,
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

const CATEGORY_GUIDE = EVENT_CATEGORIES.map((c) => `  - ${c}: ${CATEGORY_INFO[c].covers}`).join("\n");

function buildPrompt(today: string): string {
  return `You read event posters for WhatsUpDurbs, a guide to events in Durban, South Africa.
Today is ${today} (Africa/Johannesburg, SAST). Extract the event shown on the poster.

Rules:
- Only use what the poster shows. Use null for anything not on the poster; never invent details.
- title: the event name as printed, in normal capitalisation.
- description: 1-2 short sentences in your own words about what the event is (performers, theme). No marketing hype.
- category: exactly one of these (pick the most specific; Popups only if nothing else fits):
${CATEGORY_GUIDE}
- area: the closest of ${DURBAN_AREAS.join(", ")} based on the venue, or null if you can't tell. Durban CBD, City Hall, Berea, Glenwood and Musgrave count as CBD & Berea; the ICC, Playhouse, Suncoast and the beachfront promenade as Central Beachfront; uShaka and the Point precinct as Point Waterfront; Sibaya and Gateway as Umhlanga; eMdloti (Umdloti) and La Mercy as eMdloti; Florida Road as Morningside; the Pavilion as Westville; Hillcrest, Kloof, Gillitts and Botha's Hill as Upper Highway.
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

type RawGeminiResponse = {
  error?: { message?: string; status?: string };
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
} | null;

type Part = { inline_data: { mime_type: string; data: string } } | { text: string };

/** One request to one model, returning parsed JSON. Throws GeminiError describing whether to retry. */
async function callGemini(
  model: string,
  key: string,
  parts: Part[],
  schema: object,
  timeoutMs: number,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${GEMINI_API}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      }),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new GeminiError(`${model} took too long to answer.`, 504, true);
    }
    throw new GeminiError(`Couldn't reach Gemini: ${err instanceof Error ? err.message : String(err)}`, 502, true);
  }

  const body = (await res.json().catch(() => null)) as RawGeminiResponse;
  if (!res.ok) {
    const detail = body?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 429) {
      throw new GeminiError(`${model}: free-tier limit reached (${detail})`, 429, false, true);
    }
    if (res.status === 404) {
      throw new GeminiError(`${model} isn't available (${detail})`, 502, false, true);
    }
    if (res.status >= 500) {
      throw new GeminiError(`${model} is overloaded (${detail})`, 503, true);
    }
    throw new GeminiError(`Gemini rejected the request: ${detail}`, 502);
  }

  if (body?.promptFeedback?.blockReason) {
    throw new GeminiError(`Gemini declined to read this image (${body.promptFeedback.blockReason}).`, 422);
  }
  const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiError(`${model} returned an unreadable answer.`, 502, true);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run a Gemini request, retrying overloaded models and falling back to a
 * lighter model, all within a fixed time budget.
 */
async function withModelFallback<T>(
  request: (model: string, key: string, timeoutMs: number) => Promise<T>,
  now: () => number = Date.now,
  budgetMs = TOTAL_BUDGET_MS,
): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new GeminiError(
      "GEMINI_API_KEY isn't set. Create a free key at aistudio.google.com and add it in Vercel → Settings → Environment Variables, then redeploy.",
      500,
    );
  }
  const primary = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const fallback = process.env.GEMINI_FALLBACK_MODEL?.trim() || DEFAULT_FALLBACK_MODEL;
  // Primary twice (overload is usually brief), then the fallback model twice.
  const plan: { model: string; waitMs: number }[] = [
    { model: primary, waitMs: 0 },
    { model: primary, waitMs: 2_000 },
    ...(fallback !== primary
      ? [
          { model: fallback, waitMs: 0 },
          { model: fallback, waitMs: 3_000 },
        ]
      : []),
  ];

  const deadline = now() + budgetMs;
  const failures: string[] = [];
  const skipModels = new Set<string>();
  let lastError: GeminiError | null = null;

  for (const step of plan) {
    if (skipModels.has(step.model)) continue;
    if (step.waitMs && lastError) {
      if (deadline - now() < step.waitMs + 5_000) break;
      await sleep(step.waitMs);
    }
    const remaining = deadline - now();
    if (remaining < 5_000) break;
    try {
      return await request(step.model, key, Math.min(MAX_ATTEMPT_MS, remaining - 1_000));
    } catch (err) {
      if (!(err instanceof GeminiError)) throw err;
      lastError = err;
      failures.push(err.message);
      if (err.tryOtherModel) skipModels.add(step.model);
      else if (!err.retryable) throw err;
    }
  }

  const allQuota = failures.length > 0 && lastError?.status === 429;
  throw new GeminiError(
    (allQuota
      ? "Gemini's free-tier limit was reached. Wait a minute and try again."
      : "Gemini is busy right now. Wait a minute and try again.") + ` (${failures.join("; ")})`,
    allQuota ? 429 : 503,
  );
}

/** Read the event details off one poster image. */
export async function extractPosterDetails(
  imageBase64: string,
  mimeType: string,
  now: () => number = Date.now,
): Promise<PosterExtraction> {
  return withModelFallback(async (model, key, timeoutMs) => {
    const json = await callGemini(
      model,
      key,
      [{ inline_data: { mime_type: mimeType, data: imageBase64 } }, { text: buildPrompt(todayInDurban()) }],
      RESPONSE_SCHEMA,
      timeoutMs,
    );
    return { ...parsePosterJson(json), model };
  }, now);
}

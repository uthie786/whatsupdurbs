// Server-only: turns new posts from followed Instagram accounts into pending events.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { EVENTS_TABLE, POSTERS_BUCKET } from "@/lib/supabase";
import { discoverAccount, postImageUrl, type InstagramMedia } from "@/lib/instagram";
import { GeminiError, extractEventFromPost, type PostExtraction } from "@/lib/gemini";
import { IMAGE_EXTENSIONS, sniffImageType, type ImageType } from "@/lib/imageSniff";
import { AREA_COORDS } from "@/lib/areas";
import { slugify } from "@/lib/filters";
import { fromSastLocalInput } from "@/lib/time";
import { errorMessage } from "@/lib/errors";

export const ACCOUNTS_TABLE = "instagram_accounts";
export const POSTS_TABLE = "instagram_posts";

/** Ignore posts older than this; they're unlikely to be about upcoming events. */
const MAX_POST_AGE_MS = 21 * 24 * 60 * 60 * 1000;
const POSTS_PER_ACCOUNT = 6;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
/** Leave this much time for a Gemini call (with retries) before starting another post. */
const GEMINI_SLOT_MS = 25_000;

export interface InstagramAccountRow {
  username: string;
  active: boolean;
  last_checked_at: string | null;
  last_error: string | null;
  created_at?: string;
}

export type PostOutcome = "event" | "not-event" | "no-date" | "past" | "no-image" | "error";

export interface InstagramSyncResult {
  accountsChecked: number;
  postsChecked: number;
  eventsAdded: number;
  outcomes: Record<PostOutcome, number>;
  accountErrors: { username: string; error: string }[];
  added: { title: string; username: string; permalink: string | null }[];
  /** True when the time budget ran out before everything was checked. */
  incomplete: boolean;
}

export interface MappedPost {
  outcome: PostOutcome;
  row?: Record<string, unknown>;
}

/** Turn Gemini's reading of a post into a pending event row (or say why not). */
export function postToEventRow(
  media: InstagramMedia,
  username: string,
  extraction: Pick<PostExtraction, "isEvent" | "fields">,
  imageUrl: string,
  now = new Date(),
): MappedPost {
  if (!extraction.isEvent) return { outcome: "not-event" };
  const f = extraction.fields;
  const start = f.start_local ? fromSastLocalInput(f.start_local) : null;
  if (!f.title || !start) return { outcome: "no-date" };
  const end = f.end_local ? fromSastLocalInput(f.end_local) : null;
  if ((end && end > start ? end : start) < now) return { outcome: "past" };

  const area = f.area ?? "Central Beachfront";
  const [latitude, longitude] = AREA_COORDS[area];
  return {
    outcome: "event",
    row: {
      title: f.title,
      slug: `${slugify(f.title) || "event"}-ig${media.id.slice(-8)}`,
      description: f.description ?? "",
      category: f.category ?? "Popups",
      venue_name: f.venue_name ?? `See @${username}`,
      address: f.address ?? "",
      area,
      latitude,
      longitude,
      start_date: start.toISOString(),
      end_date: end && end > start ? end.toISOString() : null,
      image_url: imageUrl,
      ticket_url: f.ticket_url ?? media.permalink ?? null,
      price_text: f.price_text,
      is_approved: false,
      is_featured: false,
      source: "instagram",
      external_id: `ig_${media.id}`,
      source_url: media.permalink ?? null,
    },
  };
}

interface DownloadedImage {
  bytes: Uint8Array;
  type: ImageType;
}

/** Fetch a post's image (Instagram links expire, so it's copied before use). */
async function downloadImage(url: string): Promise<DownloadedImage> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Downloading the image failed (HTTP ${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("The image is too large");
  const type = sniffImageType(bytes);
  if (!type) throw new Error("The post's image isn't a JPEG, PNG or WebP");
  return { bytes, type };
}

/** Keep our own copy of an event's poster; only done for posts that are events. */
async function storeImage(db: SupabaseClient, image: DownloadedImage, mediaId: string): Promise<string> {
  const path = `instagram/${mediaId}.${IMAGE_EXTENSIONS[image.type]}`;
  const storage = db.storage.from(POSTERS_BUCKET);
  const { error } = await storage.upload(path, image.bytes, {
    contentType: image.type,
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) throw new Error(`Saving the image failed: ${errorMessage(error)}`);
  return storage.getPublicUrl(path).data.publicUrl;
}

async function recordPost(
  db: SupabaseClient,
  media: InstagramMedia,
  username: string,
  status: PostOutcome,
  detail: string | null,
  eventId: string | null = null,
) {
  const { error } = await db.from(POSTS_TABLE).upsert(
    {
      media_id: media.id,
      username,
      permalink: media.permalink ?? null,
      posted_at: media.timestamp ?? null,
      status,
      detail: detail?.slice(0, 500) ?? null,
      event_id: eventId,
      checked_at: new Date().toISOString(),
    },
    { onConflict: "media_id" },
  );
  if (error) console.error(`Recording Instagram post ${media.id} failed:`, errorMessage(error));
}

/**
 * Check followed accounts (least recently checked first) and add new event posts
 * to the Pending queue, stopping before the time budget runs out.
 */
export async function runInstagramSync(
  budgetMs = 50_000,
  supabase: SupabaseClient = getSupabaseAdmin(),
): Promise<InstagramSyncResult> {
  const started = Date.now();
  const remaining = () => budgetMs - (Date.now() - started);
  const result: InstagramSyncResult = {
    accountsChecked: 0,
    postsChecked: 0,
    eventsAdded: 0,
    outcomes: { event: 0, "not-event": 0, "no-date": 0, past: 0, "no-image": 0, error: 0 },
    accountErrors: [],
    added: [],
    incomplete: false,
  };

  const { data: accounts, error } = await supabase
    .from(ACCOUNTS_TABLE)
    .select("username, active, last_checked_at, last_error")
    .eq("active", true)
    .order("last_checked_at", { ascending: true, nullsFirst: true });
  if (error) throw new Error(`Loading Instagram accounts failed: ${errorMessage(error)}`);

  let geminiUnavailable = false;
  for (const account of (accounts ?? []) as InstagramAccountRow[]) {
    if (geminiUnavailable || remaining() < GEMINI_SLOT_MS + 5_000) {
      result.incomplete = true;
      break;
    }
    let media: InstagramMedia[];
    try {
      media = (await discoverAccount(account.username, POSTS_PER_ACCOUNT)).media;
    } catch (err) {
      const message = errorMessage(err);
      result.accountErrors.push({ username: account.username, error: message });
      await supabase
        .from(ACCOUNTS_TABLE)
        .update({ last_checked_at: new Date().toISOString(), last_error: message })
        .eq("username", account.username);
      continue;
    }
    result.accountsChecked++;

    const cutoff = Date.now() - MAX_POST_AGE_MS;
    const recent = media.filter((m) => m.id && (!m.timestamp || new Date(m.timestamp).getTime() >= cutoff));
    const { data: seen } = await supabase
      .from(POSTS_TABLE)
      .select("media_id")
      .in("media_id", recent.length ? recent.map((m) => m.id) : ["-"]);
    const seenIds = new Set((seen ?? []).map((r) => r.media_id as string));
    const fresh = recent.filter((m) => !seenIds.has(m.id));

    let finishedAccount = true;
    for (const post of fresh) {
      if (remaining() < GEMINI_SLOT_MS) {
        finishedAccount = false;
        result.incomplete = true;
        break;
      }
      result.postsChecked++;
      const imageUrl = postImageUrl(post);
      if (!imageUrl) {
        result.outcomes["no-image"]++;
        await recordPost(supabase, post, account.username, "no-image", "No still image available for this post");
        continue;
      }
      try {
        const image = await downloadImage(imageUrl);
        const extraction = await extractEventFromPost(
          Buffer.from(image.bytes).toString("base64"),
          image.type,
          { account: account.username, caption: post.caption ?? "", postedAt: post.timestamp ?? null },
          Math.max(10_000, remaining() - 5_000),
        );
        const mapped = postToEventRow(post, account.username, extraction, "");
        result.outcomes[mapped.outcome]++;
        if (!mapped.row) {
          await recordPost(supabase, post, account.username, mapped.outcome, extraction.notes);
          continue;
        }
        mapped.row.image_url = await storeImage(supabase, image, post.id);
        const { data: inserted, error: insertError } = await supabase
          .from(EVENTS_TABLE)
          .upsert(mapped.row, { onConflict: "external_id", ignoreDuplicates: true })
          .select("id")
          .maybeSingle();
        if (insertError) throw new Error(`Saving the event failed: ${errorMessage(insertError)}`);
        if (inserted) {
          result.eventsAdded++;
          result.added.push({ title: String(mapped.row.title), username: account.username, permalink: post.permalink ?? null });
        }
        await recordPost(supabase, post, account.username, "event", extraction.notes, (inserted?.id as string | undefined) ?? null);
      } catch (err) {
        if (err instanceof GeminiError && [429, 503, 504].includes(err.status)) {
          // Gemini is busy or out of free quota: leave this post unrecorded so the next run retries it.
          result.postsChecked--;
          result.accountErrors.push({ username: account.username, error: errorMessage(err) });
          geminiUnavailable = true;
          finishedAccount = false;
          result.incomplete = true;
          break;
        }
        result.outcomes.error++;
        // Recorded as "error" so one broken post can't block the queue; it can be re-checked by deleting its row.
        await recordPost(supabase, post, account.username, "error", errorMessage(err));
      }
    }

    // Only mark an account checked once all its new posts were handled.
    if (finishedAccount) {
      await supabase
        .from(ACCOUNTS_TABLE)
        .update({ last_checked_at: new Date().toISOString(), last_error: null })
        .eq("username", account.username);
    } else {
      break;
    }
  }

  return result;
}

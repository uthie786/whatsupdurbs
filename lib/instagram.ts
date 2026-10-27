// Server-only: reads public posts of Instagram business/creator accounts via
// Meta's Graph API "Business Discovery", using our own Instagram account.
// Docs: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery

const GRAPH_VERSION = process.env.META_GRAPH_VERSION?.trim() || "v21.0";
const GRAPH_API = `https://graph.facebook.com/${GRAPH_VERSION}`;
const REQUEST_TIMEOUT_MS = 20_000;

export interface InstagramMedia {
  id: string;
  caption?: string | null;
  media_type?: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | string;
  media_url?: string | null;
  thumbnail_url?: string | null;
  permalink?: string | null;
  timestamp?: string | null;
  children?: { data?: { media_type?: string; media_url?: string | null }[] } | null;
}

export interface DiscoveredAccount {
  username: string;
  name?: string | null;
  media: InstagramMedia[];
}

export class InstagramApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
  ) {
    super(message);
  }
}

/** Valid Instagram usernames: letters, numbers, dots and underscores, up to 30 characters. */
export function normalizeUsername(input: string): string | null {
  const u = input
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(u) ? u : null;
}

function config() {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  const igUserId = process.env.INSTAGRAM_USER_ID?.trim();
  if (!token || !igUserId) {
    throw new InstagramApiError(
      "META_ACCESS_TOKEN and INSTAGRAM_USER_ID must both be set in Vercel's environment variables.",
      500,
    );
  }
  return { token, igUserId };
}

/** Turn Meta's error codes into advice the admin can act on. */
function explain(code: number | undefined, message: string): string {
  switch (code) {
    case 10:
    case 200:
      return `Meta says the app isn't allowed to do this yet (${message}). The app probably needs Advanced Access via App Review, or the token is missing instagram_basic / pages_read_engagement.`;
    case 190:
      return `The Meta access token is invalid or expired (${message}). Generate a new system-user token and update META_ACCESS_TOKEN.`;
    case 4:
    case 17:
    case 32:
    case 613:
      return `Meta's rate limit was reached (${message}). The next run will try again.`;
    case 110:
      return `Instagram couldn't find that account, or it's a personal account (${message}). Only business/creator accounts can be read.`;
    default:
      return message;
  }
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const { token } = config();
  const qs = new URLSearchParams({ ...params, access_token: token });
  let res: Response;
  try {
    res = await fetch(`${GRAPH_API}/${path}?${qs}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new InstagramApiError(timedOut ? "Instagram took too long to answer." : `Couldn't reach Instagram: ${String(err)}`, 504);
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: { message?: string; code?: number } }) | null;
  if (!res.ok || body?.error) {
    const code = body?.error?.code;
    // Business Discovery reports a missing/personal account as code 110 with subcode 2207013.
    throw new InstagramApiError(explain(code, body?.error?.message ?? `HTTP ${res.status}`), res.status || 502, code);
  }
  return body as T;
}

/** Our own connected Instagram account (checks the token and user ID). */
export async function getOwnAccount(): Promise<{ id: string; username: string }> {
  const { igUserId } = config();
  return graphGet(igUserId, { fields: "id,username" });
}

/** The most recent posts of another business/creator account. */
export async function discoverAccount(username: string, limit = 6): Promise<DiscoveredAccount> {
  const { igUserId } = config();
  const fields =
    `business_discovery.username(${username}){username,name,` +
    `media.limit(${limit}){id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url}}}`;
  const body = await graphGet<{
    business_discovery?: { username: string; name?: string; media?: { data?: InstagramMedia[] } };
  }>(igUserId, { fields });
  const d = body.business_discovery;
  if (!d) throw new InstagramApiError(`Instagram returned no data for @${username}.`, 502);
  return { username: d.username, name: d.name ?? null, media: d.media?.data ?? [] };
}

/** The best still image for a post: the photo, first carousel photo, or a video's thumbnail. */
export function postImageUrl(media: InstagramMedia): string | null {
  if (media.media_type === "CAROUSEL_ALBUM") {
    const firstImage = media.children?.data?.find((c) => c.media_type === "IMAGE" && c.media_url);
    return firstImage?.media_url ?? media.media_url ?? null;
  }
  if (media.media_type === "VIDEO") return media.thumbnail_url ?? null;
  return media.media_url ?? null;
}

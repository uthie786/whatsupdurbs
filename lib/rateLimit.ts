// Server-only: simple per-IP and site-wide limits for public endpoints, stored
// in Supabase (`api_usage`) because serverless functions don't share memory.
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { errorMessage } from "@/lib/errors";

const TABLE = "api_usage";
const HOUR = 60 * 60 * 1000;

export interface RateLimit {
  perIpPerHour: number;
  globalPerDay: number;
}

export type RateLimitResult = { ok: true } | { ok: false; status: 429 | 503; message: string };

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Count recent uses and, if under the limits, record this one. */
export async function takeRateLimit(
  kind: string,
  ip: string,
  limit: RateLimit,
  client: Pick<SupabaseClient, "from"> = getSupabaseAdmin(),
  now = Date.now(),
): Promise<RateLimitResult> {
  try {
    const sinceHour = new Date(now - HOUR).toISOString();
    const sinceDay = new Date(now - 24 * HOUR).toISOString();
    const [mine, everyone] = await Promise.all([
      client.from(TABLE).select("id", { count: "exact", head: true }).eq("kind", kind).eq("ip", ip).gte("created_at", sinceHour),
      client.from(TABLE).select("id", { count: "exact", head: true }).eq("kind", kind).gte("created_at", sinceDay),
    ]);
    if (mine.error) throw mine.error;
    if (everyone.error) throw everyone.error;
    if ((mine.count ?? 0) >= limit.perIpPerHour) {
      return { ok: false, status: 429, message: "You've done that a lot in the last hour. Please try again later." };
    }
    if ((everyone.count ?? 0) >= limit.globalPerDay) {
      return { ok: false, status: 429, message: "This is very popular today. Please try again tomorrow, or fill the form in by hand." };
    }
    const { error } = await client.from(TABLE).insert({ kind, ip });
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    // Fail closed: without the usage table we can't protect the free AI quota.
    console.error(`Rate limit check for ${kind} failed:`, errorMessage(err));
    return { ok: false, status: 503, message: "This feature isn't available right now. Please fill the form in by hand." };
  }
}

/** Drop usage rows older than two days (called from the hourly sync). */
export async function purgeOldUsage(): Promise<void> {
  const cutoff = new Date(Date.now() - 48 * HOUR).toISOString();
  const { error } = await getSupabaseAdmin().from(TABLE).delete().lt("created_at", cutoff);
  if (error) console.error("Purging api_usage failed:", errorMessage(error));
}

// Server-only request authorisation for admin/cron API routes.
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function bearerToken(req: NextRequest): string {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

/** A signed-in admin's Supabase access token. */
export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  const token = bearerToken(req);
  if (!token) return false;
  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(token);
    return !error && Boolean(data.user);
  } catch (err) {
    console.error("Admin token check failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/** Scheduled jobs (Vercel Cron, Supabase pg_cron) send `Bearer $CRON_SECRET`. */
export function isCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && bearerToken(req) === secret;
}

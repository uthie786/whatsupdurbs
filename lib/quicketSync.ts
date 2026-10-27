// Server-only helpers for storing Quicket events and tracking sync progress.
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { DENIED_RETENTION_MS, EVENTS_TABLE } from "@/lib/supabase";
import type { QuicketEventRow } from "@/lib/quicket";
import { errorMessage } from "@/lib/errors";

const SYNC_STATE_TABLE = "sync_state";
const STATE_KEY = "quicket";

const MINUTE = 60_000;
/** Re-read a little before the last success so nothing slips between runs. */
export const WINDOW_OVERLAP_MS = 10 * MINUTE;
/** First ever run looks back this far. */
export const FIRST_WINDOW_MS = 60 * MINUTE;
/** Quicket took ~26-33s for 2h of changes against its ~31s limit; stay under that. */
export const MAX_WINDOW_MS = 2 * 60 * MINUTE;
/** When we've fallen too far behind, restart from this far back. */
export const RECOVERY_WINDOW_MS = 75 * MINUTE;

export interface SyncWindow {
  since: Date;
  /** Set when changes between `skippedFrom` and `since` couldn't be fetched. */
  skippedFrom: Date | null;
}

export function computeSyncWindow(lastSuccess: Date | null, now = new Date()): SyncWindow {
  if (!lastSuccess) return { since: new Date(now.getTime() - FIRST_WINDOW_MS), skippedFrom: null };
  const since = new Date(lastSuccess.getTime() - WINDOW_OVERLAP_MS);
  if (now.getTime() - since.getTime() > MAX_WINDOW_MS) {
    return { since: new Date(now.getTime() - RECOVERY_WINDOW_MS), skippedFrom: since };
  }
  return { since, skippedFrom: null };
}

export interface SyncState {
  last_success: string | null;
  last_error: string | null;
  updated_at?: string;
}

export async function readSyncState(): Promise<SyncState> {
  const { data, error } = await getSupabaseAdmin()
    .from(SYNC_STATE_TABLE)
    .select("last_success, last_error, updated_at")
    .eq("key", STATE_KEY)
    .maybeSingle();
  if (error) throw new Error(`Reading sync_state failed (run the latest schema SQL?): ${error.message}`);
  return data ?? { last_success: null, last_error: null };
}

export async function writeSyncState(patch: Partial<SyncState>): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from(SYNC_STATE_TABLE)
    .upsert({ key: STATE_KEY, ...patch, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) console.error("Writing sync_state failed:", error.message);
}

/** Insert new events as published; update existing ones without touching moderation flags. */
export async function saveQuicketRows(rows: QuicketEventRow[]) {
  if (!rows.length) return { inserted: 0, updated: 0, failed: 0, errors: [] as string[] };
  const supabase = getSupabaseAdmin();
  const lookup = (columns: string) =>
    supabase
      .from(EVENTS_TABLE)
      .select(columns)
      .eq("source", "quicket")
      .in("external_id", rows.map((r) => r.external_id));
  let { data: existing, error } = await lookup("external_id, edited_at");
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    // Database without the edited_at column yet: treat nothing as edited.
    ({ data: existing, error } = await lookup("external_id"));
  }
  if (error) throw new Error(`Looking up existing Quicket events failed: ${errorMessage(error)}`);

  const rowsFound = (existing ?? []) as unknown as { external_id: string; edited_at?: string | null }[];
  const known = new Set(rowsFound.map((r) => r.external_id));
  // Events an admin has edited keep their edits; the sync no longer updates them.
  const edited = new Set(rowsFound.filter((r) => r.edited_at).map((r) => r.external_id));
  const fresh = rows.filter((r) => !known.has(r.external_id));
  const stale = rows.filter((r) => known.has(r.external_id) && !edited.has(r.external_id));
  let failed = 0;
  const errors: string[] = [];

  if (fresh.length) {
    const toInsert = fresh.map((r) => ({ ...r, is_approved: true, is_featured: false }));
    const { error: insertError } = await supabase.from(EVENTS_TABLE).insert(toInsert);
    if (insertError) {
      // One bad row fails the batch; retry individually so the rest still land.
      for (const row of toInsert) {
        const { error: rowError } = await supabase.from(EVENTS_TABLE).insert(row);
        if (rowError) {
          failed++;
          errors.push(errorMessage(rowError));
          console.error(`Quicket insert ${row.external_id} failed: ${errorMessage(rowError)}`);
        }
      }
    }
  }

  if (stale.length) {
    const { error: updateError } = await supabase
      .from(EVENTS_TABLE)
      .upsert(stale, { onConflict: "external_id" });
    if (updateError) throw new Error(`Updating Quicket events failed: ${errorMessage(updateError)}`);
  }

  return { inserted: fresh.length - failed, updated: stale.length, failed, errors };
}

/** Backup for the Supabase pg_cron job: drop denials older than 24h. */
export async function purgeDeniedEvents(): Promise<number> {
  const cutoff = new Date(Date.now() - DENIED_RETENTION_MS).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from(EVENTS_TABLE)
    .delete()
    .not("denied_at", "is", null)
    .lt("denied_at", cutoff)
    .select("id");
  if (error) {
    console.error("Purging denied events failed:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

import { NextResponse, type NextRequest } from "next/server";
import { subDays } from "date-fns";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  QUICKET_PAGE_SIZES,
  fetchQuicketPageWithFallback,
  mapQuicketEvent,
  type QuicketEventRow,
  type SkipReason,
} from "@/lib/quicket";
import { DENIED_RETENTION_MS, EVENTS_TABLE } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Stop starting new pages after this long so we finish inside maxDuration. */
const TIME_BUDGET_MS = 45_000;

/** Backup for the Supabase pg_cron job: drop denials older than 24h. */
async function purgeDenied(): Promise<number> {
  const cutoff = new Date(Date.now() - DENIED_RETENTION_MS).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from(EVENTS_TABLE)
    .delete()
    .not("denied_at", "is", null)
    .lt("denied_at", cutoff)
    .select("id");
  if (error) {
    // Column may not exist yet if the migration hasn't been run.
    console.error("Purging denied events failed:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;

  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && token === cronSecret) return true;

  // Otherwise accept a signed-in admin's Supabase access token.
  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(token);
    return !error && Boolean(data.user);
  } catch (err) {
    console.error("Admin token check failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

async function saveRows(rows: QuicketEventRow[]) {
  const supabase = getSupabaseAdmin();
  const ids = rows.map((r) => r.external_id);
  const { data: existing, error } = await supabase
    .from(EVENTS_TABLE)
    .select("external_id")
    .eq("source", "quicket")
    .in("external_id", ids);
  if (error) throw error;

  const known = new Set((existing ?? []).map((r) => r.external_id as string));
  const fresh = rows.filter((r) => !known.has(r.external_id));
  const stale = rows.filter((r) => known.has(r.external_id));
  let failed = 0;

  if (fresh.length) {
    const toInsert = fresh.map((r) => ({ ...r, is_approved: true, is_featured: false }));
    const { error: insertError } = await supabase.from(EVENTS_TABLE).insert(toInsert);
    if (insertError) {
      // One bad row fails the batch; retry individually so the rest still land.
      for (const row of toInsert) {
        const { error: rowError } = await supabase.from(EVENTS_TABLE).insert(row);
        if (rowError) {
          failed++;
          console.error(`Quicket insert ${row.external_id} failed: ${rowError.message}`);
        }
      }
    }
  }

  if (stale.length) {
    // Content fields only, so admin approve/feature/unpublish decisions stick.
    const { error: updateError } = await supabase
      .from(EVENTS_TABLE)
      .upsert(stale, { onConflict: "external_id" });
    if (updateError) throw updateError;
  }

  return { inserted: fresh.length - failed, updated: stale.length, failed };
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const mode = params.get("mode") === "recent" ? "recent" : "full";
  const startPage = Math.max(1, parseInt(params.get("startPage") ?? "1", 10) || 1);
  const requestedSize = parseInt(params.get("pageSize") ?? "", 10);
  let pageSize = (QUICKET_PAGE_SIZES as readonly number[]).includes(requestedSize)
    ? requestedSize
    : QUICKET_PAGE_SIZES[0];
  const dryRun = params.get("dryRun") === "1";
  const lastModified = mode === "recent" ? subDays(new Date(), 3) : undefined;

  const started = Date.now();
  const totals = { processed: 0, inserted: 0, updated: 0, failed: 0 };
  const skipped: Record<SkipReason, number> = {
    "no-location": 0,
    "outside-durban": 0,
    past: 0,
    invalid: 0,
  };
  let page = startPage;
  let pages = startPage;
  let purged = 0;
  const sample: QuicketEventRow[] = [];

  try {
    if (startPage === 1 && !dryRun) purged = await purgeDenied();

    while (page <= pages && Date.now() - started < TIME_BUDGET_MS) {
      const fetched = await fetchQuicketPageWithFallback(page, pageSize, lastModified);
      const result = fetched.result;
      page = fetched.page;
      pageSize = fetched.pageSize;
      pages = result.pages || 0;
      const rows: QuicketEventRow[] = [];
      for (const event of result.results ?? []) {
        totals.processed++;
        const mapped = mapQuicketEvent(event);
        if ("row" in mapped) rows.push(mapped.row);
        else skipped[mapped.skip]++;
      }
      if (dryRun) {
        sample.push(...rows.slice(0, Math.max(0, 5 - sample.length)));
        totals.inserted += rows.length;
      } else if (rows.length) {
        const saved = await saveRows(rows);
        totals.inserted += saved.inserted;
        totals.updated += saved.updated;
        totals.failed += saved.failed;
      }
      page++;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Quicket sync failed:", message);
    return NextResponse.json(
      { error: message, ...totals, skipped, nextPage: page, pageSize },
      { status: 502 },
    );
  }

  return NextResponse.json({
    mode,
    dryRun,
    ...totals,
    skipped,
    purged,
    pages,
    pageSize,
    nextPage: page <= pages ? page : null,
    ...(dryRun ? { sample } : {}),
    ms: Date.now() - started,
  });
}

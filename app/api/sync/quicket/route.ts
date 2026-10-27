import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest, isCronRequest } from "@/lib/adminAuth";
import {
  QuicketApiError,
  fetchQuicketPage,
  mapQuicketEvent,
  type QuicketEventRow,
  type SkipReason,
} from "@/lib/quicket";
import {
  computeSyncWindow,
  purgeDeniedEvents,
  readSyncState,
  saveQuicketRows,
  writeSyncState,
} from "@/lib/quicketSync";
import { errorMessage } from "@/lib/errors";
import { purgeOldUsage } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Don't start another (~30s) Quicket page after this point. */
const NEXT_PAGE_CUTOFF_MS = 15_000;

/**
 * Incremental sync: pulls Quicket events modified since the last successful
 * run. Quicket's list endpoint only copes with small windows, so this is meant
 * to run hourly (Supabase pg_cron) with a daily Vercel Cron as a backup.
 *
 * `?dryRun=1` fetches and maps without saving or moving the sync cursor.
 */
export async function GET(req: NextRequest) {
  if (!isCronRequest(req) && !(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const started = new Date();
  const totals = { processed: 0, inserted: 0, updated: 0, failed: 0 };
  const skipped: Record<SkipReason, number> = {
    "no-location": 0,
    "outside-durban": 0,
    past: 0,
    invalid: 0,
  };
  const sample: QuicketEventRow[] = [];
  let state: Awaited<ReturnType<typeof readSyncState>> = { last_success: null, last_error: null };

  try {
    try {
      state = await readSyncState();
    } catch (err) {
      // A dry run is a diagnostic; let it work even before Supabase is set up.
      if (!dryRun) throw err;
    }
    const window = computeSyncWindow(state.last_success ? new Date(state.last_success) : null, started);
    const purged = dryRun ? 0 : await purgeDeniedEvents();
    if (!dryRun) await purgeOldUsage();

    let page = 1;
    let pages = 1;
    while (page <= pages) {
      if (page > 1 && Date.now() - started.getTime() > NEXT_PAGE_CUTOFF_MS) break;
      const result = await fetchQuicketPage(page, window.since);
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
      } else {
        const saved = await saveQuicketRows(rows);
        totals.inserted += saved.inserted;
        totals.updated += saved.updated;
        totals.failed += saved.failed;
      }
      page++;
    }

    const complete = page > pages;
    const notes: string[] = [];
    if (window.skippedFrom) {
      notes.push(
        `Sync was too far behind; changes between ${window.skippedFrom.toISOString()} and ${window.since.toISOString()} were skipped.`,
      );
    }
    if (!complete) notes.push(`Only ${page - 1} of ${pages} pages fetched; the next run will retry.`);

    if (!dryRun) {
      // Only move the cursor once every page in the window has been saved.
      await writeSyncState({
        ...(complete ? { last_success: started.toISOString() } : {}),
        last_error: notes.length ? notes.join(" ") : null,
      });
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      since: window.since.toISOString(),
      ...totals,
      skipped,
      purged,
      pages,
      complete,
      notes,
      lastSuccess: complete && !dryRun ? started.toISOString() : state.last_success,
      ...(dryRun ? { sample } : {}),
      ms: Date.now() - started.getTime(),
    });
  } catch (err) {
    const message = errorMessage(err);
    // Quicket's list query regularly times out on its own server; that's not our fault and
    // the next hourly run retries, so report it as a temporary hiccup rather than a failure.
    const transient = err instanceof QuicketApiError && err.status >= 500;
    console.error("Quicket sync failed:", message);
    if (!dryRun) await writeSyncState({ last_error: message }).catch(() => {});
    return NextResponse.json(
      {
        ok: false,
        transient,
        error: transient
          ? "Quicket's server was too slow this time; the hourly sync will try again."
          : message,
        detail: transient ? message : undefined,
        ...totals,
        skipped,
        lastSuccess: state.last_success,
      },
      { status: 502 },
    );
  }
}

// Anonymous event counters: how often each event page is opened and its ticket link tapped.
// No cookies, IPs or visitor IDs: the database only stores per-event daily totals.
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { sastDayKey } from "@/lib/time";

export type StatKind = "view" | "ticket";

export interface StatRow {
  event_id: string;
  day: string;
  kind: StatKind;
  count: number;
}

const SEEN_KEY = "whatsupdurbs-counted";
const DEMO_KEY = "whatsupdurbs-demo-stats";

function seen(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** Count once per event and kind per browser tab session, so refreshes don't inflate totals. */
function firstTime(key: string): boolean {
  const s = seen();
  if (s.has(key)) return false;
  s.add(key);
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...s]));
  } catch {
    // Storage blocked: count anyway.
  }
  return true;
}

function demoRows(): StatRow[] {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY) ?? "[]") as StatRow[];
  } catch {
    return [];
  }
}

export function trackEvent(eventId: string, kind: StatKind): void {
  if (typeof window === "undefined" || !firstTime(`${kind}:${eventId}`)) return;

  if (!isSupabaseConfigured || !supabase) {
    // Demo mode: keep counts in this browser so /admin/stats has something to show.
    const rows = demoRows();
    const day = sastDayKey(new Date());
    const row = rows.find((r) => r.event_id === eventId && r.kind === kind && r.day === day);
    if (row) row.count += 1;
    else rows.push({ event_id: eventId, day, kind, count: 1 });
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(rows));
    } catch {
      // ignore
    }
    return;
  }

  const client = supabase;
  // Admins checking their own events shouldn't count.
  void client.auth.getSession().then(({ data }) => {
    if (data.session) return;
    void client.rpc("track_event", { p_event: eventId, p_kind: kind }).then(() => {}, () => {});
  });
}

/** Daily totals since `fromDay` (YYYY-MM-DD, SAST), or all time. Admins only (RLS). */
export async function fetchStats(fromDay: string | null): Promise<StatRow[]> {
  if (!supabase) return demoRows().filter((r) => !fromDay || r.day >= fromDay);
  const rows: StatRow[] = [];
  // Page through in case there are more rows than one response returns.
  for (let from = 0; ; from += 1000) {
    let q = supabase.from("event_stats").select("event_id, day, kind, count").range(from, from + 999);
    if (fromDay) q = q.gte("day", fromDay);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...((data ?? []) as StatRow[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

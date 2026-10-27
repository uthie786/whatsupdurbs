import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeUsername } from "@/lib/instagram";
import { ACCOUNTS_TABLE, POSTS_TABLE } from "@/lib/instagramSync";
import { errorMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const failed = (err: unknown) => NextResponse.json({ error: errorMessage(err) }, { status: 500 });

/** Followed accounts plus how many of their posts became events. */
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) return unauthorized();
  const supabase = getSupabaseAdmin();
  const [{ data: accounts, error }, { data: posts, error: postsError }] = await Promise.all([
    supabase.from(ACCOUNTS_TABLE).select("username, active, last_checked_at, last_error, created_at").order("username"),
    supabase
      .from(POSTS_TABLE)
      .select("username, status")
      .gte("checked_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ]);
  if (error) return failed(error);
  if (postsError) return failed(postsError);
  const stats = new Map<string, { checked: number; events: number }>();
  for (const p of posts ?? []) {
    const s = stats.get(p.username as string) ?? { checked: 0, events: 0 };
    s.checked++;
    if (p.status === "event") s.events++;
    stats.set(p.username as string, s);
  }
  return NextResponse.json({
    accounts: (accounts ?? []).map((a) => ({ ...a, ...(stats.get(a.username as string) ?? { checked: 0, events: 0 }) })),
    configured: Boolean(process.env.META_ACCESS_TOKEN && process.env.INSTAGRAM_USER_ID),
  });
}

/** Follow one or more accounts: { usernames: "a, @b, instagram.com/c" }. */
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { usernames?: unknown };
  const raw = typeof body.usernames === "string" ? body.usernames.split(/[\s,]+/) : [];
  const usernames = Array.from(new Set(raw.map(normalizeUsername).filter((u): u is string => Boolean(u))));
  if (!usernames.length) {
    return NextResponse.json({ error: "Enter Instagram usernames like @iheartmarket." }, { status: 400 });
  }
  const { error } = await getSupabaseAdmin()
    .from(ACCOUNTS_TABLE)
    .upsert(usernames.map((username) => ({ username, active: true })), { onConflict: "username", ignoreDuplicates: true });
  if (error) return failed(error);
  return NextResponse.json({ ok: true, added: usernames });
}

/** Pause or resume an account: { username, active }. */
export async function PATCH(req: NextRequest) {
  if (!(await isAdminRequest(req))) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { username?: unknown; active?: unknown };
  const username = typeof body.username === "string" ? normalizeUsername(body.username) : null;
  if (!username || typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Send a username and active true/false." }, { status: 400 });
  }
  const { error } = await getSupabaseAdmin().from(ACCOUNTS_TABLE).update({ active: body.active }).eq("username", username);
  if (error) return failed(error);
  return NextResponse.json({ ok: true });
}

/** Stop following an account: ?username=... */
export async function DELETE(req: NextRequest) {
  if (!(await isAdminRequest(req))) return unauthorized();
  const username = normalizeUsername(req.nextUrl.searchParams.get("username") ?? "");
  if (!username) return NextResponse.json({ error: "Missing username." }, { status: 400 });
  const { error } = await getSupabaseAdmin().from(ACCOUNTS_TABLE).delete().eq("username", username);
  if (error) return failed(error);
  return NextResponse.json({ ok: true });
}

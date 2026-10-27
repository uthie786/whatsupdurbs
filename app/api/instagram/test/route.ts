import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { discoverAccount, getOwnAccount, normalizeUsername } from "@/lib/instagram";
import { errorMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

interface Check {
  step: string;
  ok: boolean;
  detail: string;
}

/** Step-by-step check of the Instagram setup, so the admin sees exactly what's missing. */
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const checks: Check[] = [];

  const hasToken = Boolean(process.env.META_ACCESS_TOKEN?.trim());
  const hasId = Boolean(process.env.INSTAGRAM_USER_ID?.trim());
  checks.push({
    step: "Settings",
    ok: hasToken && hasId,
    detail:
      hasToken && hasId
        ? "META_ACCESS_TOKEN and INSTAGRAM_USER_ID are set."
        : `Missing in Vercel: ${[!hasToken && "META_ACCESS_TOKEN", !hasId && "INSTAGRAM_USER_ID"].filter(Boolean).join(", ")}.`,
  });
  if (!hasToken || !hasId) return NextResponse.json({ ok: false, checks });

  try {
    const own = await getOwnAccount();
    checks.push({ step: "Your account", ok: true, detail: `Connected as @${own.username}.` });
  } catch (err) {
    checks.push({ step: "Your account", ok: false, detail: errorMessage(err) });
    return NextResponse.json({ ok: false, checks });
  }

  const username = normalizeUsername(req.nextUrl.searchParams.get("username") ?? "");
  if (username) {
    try {
      const found = await discoverAccount(username, 3);
      const withImages = found.media.filter((m) => m.media_url || m.thumbnail_url).length;
      checks.push({
        step: `Reading @${username}`,
        ok: true,
        detail: `Found ${found.media.length} recent posts (${withImages} with images).`,
      });
    } catch (err) {
      checks.push({ step: `Reading @${username}`, ok: false, detail: errorMessage(err) });
    }
  }

  return NextResponse.json({ ok: checks.every((c) => c.ok), checks });
}

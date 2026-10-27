import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest, isCronRequest } from "@/lib/adminAuth";
import { runInstagramSync } from "@/lib/instagramSync";
import { errorMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Check followed Instagram accounts for new event posts (hourly via Supabase pg_cron, or from /admin). */
export async function GET(req: NextRequest) {
  if (!isCronRequest(req) && !(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await runInstagramSync()) });
  } catch (err) {
    console.error("Instagram sync failed:", errorMessage(err));
    return NextResponse.json({ ok: false, error: errorMessage(err) }, { status: 502 });
  }
}

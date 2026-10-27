import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { QuicketApiError, fetchQuicketEvent, mapQuicketEvent, parseQuicketEventId } from "@/lib/quicket";
import { saveQuicketRows } from "@/lib/quicketSync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SKIP_MESSAGES = {
  "outside-durban": "That event isn't within 45 km of Durban.",
  past: "That event has already ended.",
  "no-location": "That event has no venue location on Quicket, so it can't go on the map.",
  invalid: "Quicket returned incomplete details for that event.",
} as const;

/** Import one Quicket event by link or ID (a single Quicket API request). */
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { url?: string };
  const id = parseQuicketEventId(body.url ?? "");
  if (!id) {
    return NextResponse.json(
      { error: "Paste a Quicket event link like https://www.quicket.co.za/events/123456-name/ or its number." },
      { status: 400 },
    );
  }

  try {
    const event = await fetchQuicketEvent(id);
    const mapped = mapQuicketEvent(event);
    if (!("row" in mapped)) {
      return NextResponse.json({ error: SKIP_MESSAGES[mapped.skip], id }, { status: 422 });
    }
    const saved = await saveQuicketRows([mapped.row]);
    if (saved.failed) {
      return NextResponse.json({ error: "Saving the event failed; check the server logs.", id }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      id,
      title: mapped.row.title,
      action: saved.inserted ? "inserted" : "updated",
    });
  } catch (err) {
    const notFound = err instanceof QuicketApiError && err.status === 404;
    const message = notFound
      ? "Quicket couldn't find that event (it may be private or deleted)."
      : err instanceof Error
        ? err.message
        : String(err);
    return NextResponse.json({ error: message, id }, { status: notFound ? 404 : 502 });
  }
}

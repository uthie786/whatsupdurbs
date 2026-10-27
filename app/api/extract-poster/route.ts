import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { GeminiError, extractPosterDetails } from "@/lib/gemini";
import { errorMessage } from "@/lib/errors";
import { clientIp, takeRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
/** Base64 length for ~3 MB of image data; pages resize well below this. */
const MAX_BASE64_LENGTH = 4_000_000;
/** Organisers on /submit share the free Gemini quota with admins, so cap them. */
const PUBLIC_LIMIT = { perIpPerHour: 5, globalPerDay: 150 };

/** Read event details off a poster image. Admins are unlimited; the public is rate-limited. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { imageBase64?: unknown; mimeType?: unknown } | null;
  const imageBase64 = typeof body?.imageBase64 === "string" ? body.imageBase64 : "";
  const mimeType = typeof body?.mimeType === "string" ? body.mimeType : "";
  if (!imageBase64 || !ALLOWED_TYPES.has(mimeType)) {
    return NextResponse.json({ error: "Send a JPEG, PNG or WebP image." }, { status: 400 });
  }
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: "That image is too large; try a smaller one." }, { status: 413 });
  }

  if (!(await isAdminRequest(req))) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Poster reading isn't set up on this site yet." }, { status: 503 });
    }
    const limited = await takeRateLimit("extract", clientIp(req), PUBLIC_LIMIT);
    if (!limited.ok) return NextResponse.json({ error: limited.message }, { status: limited.status });
  }

  try {
    return NextResponse.json(await extractPosterDetails(imageBase64, mimeType));
  } catch (err) {
    const status = err instanceof GeminiError ? err.status : 500;
    console.error("Poster extraction failed:", errorMessage(err));
    return NextResponse.json({ error: errorMessage(err) }, { status });
  }
}

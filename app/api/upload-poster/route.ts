import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { POSTERS_BUCKET } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { clientIp, takeRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const MAX_BYTES = 3 * 1024 * 1024;
const LIMIT = { perIpPerHour: 10, globalPerDay: 300 };

/** Magic bytes, so only real images get stored whatever the client claims. */
function sniffImageType(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

/** Store an organiser's poster for a pending submission and return its public URL. */
export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Poster uploads aren't set up on this site yet." }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as { imageBase64?: unknown } | null;
  const base64 = typeof body?.imageBase64 === "string" ? body.imageBase64 : "";
  const buf = Buffer.from(base64, "base64");
  if (!buf.length) return NextResponse.json({ error: "No image received." }, { status: 400 });
  if (buf.length > MAX_BYTES) return NextResponse.json({ error: "That image is too large (max 3 MB)." }, { status: 413 });
  const type = sniffImageType(buf);
  if (!type) return NextResponse.json({ error: "Only JPEG, PNG or WebP images can be uploaded." }, { status: 400 });

  const limited = await takeRateLimit("upload", clientIp(req), LIMIT);
  if (!limited.ok) return NextResponse.json({ error: limited.message }, { status: limited.status });

  const path = `submissions/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${EXTENSIONS[type]}`;
  const storage = getSupabaseAdmin().storage.from(POSTERS_BUCKET);
  const { error } = await storage.upload(path, buf, { contentType: type, cacheControl: "31536000" });
  if (error) {
    console.error("Poster upload failed:", errorMessage(error));
    return NextResponse.json({ error: `Uploading the poster failed: ${errorMessage(error)}` }, { status: 500 });
  }
  return NextResponse.json({ url: storage.getPublicUrl(path).data.publicUrl });
}

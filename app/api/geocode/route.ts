import { NextResponse, type NextRequest } from "next/server";
import { geocodeVenue } from "@/lib/geocode";
import { errorMessage } from "@/lib/errors";
import { clientIp, takeRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/** Generous for people filling in a form, and keeps us well inside Nominatim's fair use. */
const LIMIT = { perIpPerHour: 60, globalPerDay: 1500 };

/** GET /api/geocode?venue=…&address=… → { results: [{ lat, lng, label }] } */
export async function GET(req: NextRequest) {
  const venue = (req.nextUrl.searchParams.get("venue") ?? "").slice(0, 200);
  const address = (req.nextUrl.searchParams.get("address") ?? "").slice(0, 300);
  if (!venue.trim() && !address.trim()) {
    return NextResponse.json({ error: "Add a venue or address." }, { status: 400 });
  }

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const limited = await takeRateLimit("geocode", clientIp(req), LIMIT);
    if (!limited.ok) return NextResponse.json({ error: limited.message }, { status: limited.status });
  }

  try {
    return NextResponse.json({ results: await geocodeVenue(venue, address) });
  } catch (err) {
    console.error("Geocoding failed:", errorMessage(err));
    return NextResponse.json({ error: "Couldn't look up that address right now. Drag the pin instead." }, { status: 502 });
  }
}

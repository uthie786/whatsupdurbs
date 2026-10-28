import { ImageResponse } from "next/og";
import { getPublishedEventBySlug } from "@/lib/eventsServer";
import {
  STORY_HEIGHT,
  STORY_WIDTH,
  StoryImage,
  loadPoster,
  loadStoryFonts,
  parseStoryTheme,
} from "@/lib/storyImage";

export const runtime = "nodejs";
export const revalidate = 300;

/** GET /events/<slug>/story?theme=yellow|pink|cyan → 1080×1920 PNG for Instagram stories. */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const event = await getPublishedEventBySlug(decodeURIComponent(params.slug));
  if (!event) return new Response("Event not found", { status: 404 });

  const theme = parseStoryTheme(new URL(req.url).searchParams.get("theme"));
  const [fonts, poster] = await Promise.all([loadStoryFonts(), loadPoster(event.image_url)]);

  return new ImageResponse(<StoryImage event={event} poster={poster} theme={theme} />, {
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
    fonts: fonts.map((f) => ({ ...f, style: "normal" as const })),
    headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}

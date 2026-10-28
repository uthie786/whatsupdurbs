// 1080×1920 Instagram story image for an event (rendered with next/og).
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DurbsEvent } from "@/types/event";
import { CATEGORY_COLORS } from "@/lib/areas";
import { formatEventDate } from "@/lib/filters";
import { SITE_URL } from "@/lib/site";
import { STORY_THEMES, type StoryTheme } from "@/lib/storyThemes";

export { parseStoryTheme } from "@/lib/storyThemes";

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;


let fontCache: Promise<{ name: string; data: Buffer; weight: 400 | 700 }[]> | null = null;

export function loadStoryFonts() {
  fontCache ??= Promise.all([
    readFile(path.join(process.cwd(), "assets/fonts/ArchivoBlack-Regular.ttf")).then((data) => ({
      name: "Archivo Black",
      data,
      weight: 400 as const,
    })),
    readFile(path.join(process.cwd(), "assets/fonts/SpaceGrotesk-Bold.ttf")).then((data) => ({
      name: "Space Grotesk",
      data,
      weight: 700 as const,
    })),
  ]);
  return fontCache;
}

/** Poster as a data URL, or null if it's missing, slow or a format satori can't draw. */
export async function loadPoster(url: string | null): Promise<string | null> {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const type = res.headers.get("content-type")?.split(";")[0].trim() ?? "";
    if (!res.ok || !["image/png", "image/jpeg", "image/jpg"].includes(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

const LOGO_MARK = (fill: string) =>
  `<path d="M110,70 L290,70 L290,210 L220,210 L220,270 L150,270 L150,170 L220,170 L220,140 L110,140 Z" fill="${fill === "#000" ? "#000" : "#FF007A"}" stroke="#000" stroke-width="12"/>` +
  (fill === "#000" ? "" : `<path d="M110,70 L290,70 L290,140 L110,140 Z" fill="#FFDF00" stroke="#000" stroke-width="12"/>`) +
  `<rect x="150" y="320" width="70" height="70" fill="${fill === "#000" ? "#000" : "#FF007A"}" stroke="#000" stroke-width="12"/>`;

const LOGO_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="98 58 232 372"><g transform="translate(14 14)">${LOGO_MARK("#000")}</g>${LOGO_MARK("color")}</svg>`,
)}`;

const BORDER = "8px solid #000";
const shadow = (n: number) => `${n}px ${n}px 0 #000`;

function titleSize(title: string): number {
  if (title.length <= 22) return 88;
  if (title.length <= 40) return 72;
  if (title.length <= 60) return 60;
  return 52;
}

function InfoRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexShrink: 0,
        alignItems: "stretch",
        border: BORDER,
        backgroundColor: "#fff",
        boxShadow: shadow(10),
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          width: 190,
          padding: "0 22px",
          backgroundColor: color,
          borderRight: BORDER,
          fontFamily: "Archivo Black",
          fontSize: 30,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flex: 1, padding: "14px 24px", fontSize: 36, lineHeight: 1.15 }}>{value}</div>
    </div>
  );
}

export function StoryImage({
  event,
  poster,
  theme,
}: {
  event: DurbsEvent;
  poster: string | null;
  theme: StoryTheme;
}) {
  const t = STORY_THEMES[theme];
  const catColor = CATEGORY_COLORS[event.category];
  const host = SITE_URL.replace(/^https?:\/\//, "");
  const title = event.title.length > 80 ? `${event.title.slice(0, 79).trimEnd()}…` : event.title;
  const where = [event.venue_name, event.area].filter(Boolean).join(" · ");

  // Everything except the poster has a fixed size; the poster takes the space left,
  // and the top ~190px and bottom ~280px stay clear of Instagram's own UI.
  return (
    <div
      style={{
        width: STORY_WIDTH,
        height: STORY_HEIGHT,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "190px 70px 280px",
        backgroundColor: t.bg,
        fontFamily: "Space Grotesk",
        color: "#000",
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: "flex",
          flexShrink: 0,
          alignItems: "center",
          padding: "12px 28px",
          border: BORDER,
          backgroundColor: "#fff",
          boxShadow: shadow(14),
          transform: "rotate(-2deg)",
          fontFamily: "Archivo Black",
          fontSize: 54,
          letterSpacing: -1,
        }}
      >
        <span>WhatsUp</span>
        <span style={{ color: "#FF2E93", marginRight: 14 }}>Durbs</span>
        <img src={LOGO_SVG} width={46} height={74} alt="" />
      </div>

      {/* Poster */}
      <div
        style={{
          display: "flex",
          position: "relative",
          flex: 1,
          minHeight: 300,
          marginTop: 52,
          width: 940,
          border: BORDER,
          boxShadow: shadow(18),
          // satori chokes on undefined style values, so spread only what applies.
          ...(poster
            ? { backgroundColor: "#000" }
            : {
                backgroundColor: catColor,
                backgroundImage:
                  "linear-gradient(45deg, rgba(0,0,0,0.12) 25%, transparent 25%, transparent 50%, rgba(0,0,0,0.12) 50%, rgba(0,0,0,0.12) 75%, transparent 75%)",
                backgroundSize: "84px 84px",
              }),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {poster ? (
          <img src={poster} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : (
          <div
            style={{
              display: "flex",
              padding: "16px 36px",
              border: BORDER,
              backgroundColor: "#fff",
              boxShadow: shadow(10),
              fontFamily: "Archivo Black",
              fontSize: 64,
              textTransform: "uppercase",
            }}
          >
            {event.category}
          </div>
        )}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: -30,
            left: 30,
            padding: "8px 22px",
            border: "6px solid #000",
            backgroundColor: catColor,
            fontFamily: "Archivo Black",
            fontSize: 30,
            textTransform: "uppercase",
            transform: "rotate(-3deg)",
          }}
        >
          {event.category}
        </div>
      </div>

      {/* Title */}
      <div
        style={{
          display: "flex",
          flexShrink: 0,
          width: "100%",
          marginTop: 44,
          fontFamily: "Archivo Black",
          fontSize: titleSize(title),
          lineHeight: 1.0,
          textTransform: "uppercase",
          letterSpacing: -1,
        }}
      >
        {title}
      </div>

      {/* Details */}
      <div style={{ display: "flex", flexShrink: 0, flexDirection: "column", gap: 20, width: "100%", marginTop: 30 }}>
        <InfoRow label="WHEN" value={formatEventDate(event)} color="#FFE600" />
        <InfoRow label="WHERE" value={where} color="#00F0FF" />
        {event.price_text && <InfoRow label="PRICE" value={event.price_text} color={theme === "pink" ? "#A3E635" : "#FF2E93"} />}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          flexShrink: 0,
          alignItems: "center",
          marginTop: 40,
          padding: "14px 28px",
          backgroundColor: "#000",
          color: t.bg,
          fontFamily: "Archivo Black",
          fontSize: 32,
          transform: "rotate(-1deg)",
        }}
      >
        <span style={{ color: "#fff", marginRight: 14 }}>Find it on</span>
        <span>{host}</span>
      </div>
    </div>
  );
}

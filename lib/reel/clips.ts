// Draws any reel clip (style × intro/outro) for a given time, including the "hold at end" pause.
import type { ReelAssets } from "./draw";
import type { ReelMedia } from "./media";
import { drawBrutalIntro, drawBrutalOutro } from "./brutal";
import { drawSunsetIntro, drawSunsetOutro } from "./sunset";
import { CLIP_DEFS, type ClipConfig, type ClipKind, type ReelStyle } from "./types";

/** When the intro's closing wipe starts (the hold is inserted just before it). */
const INTRO_CUT = 2.55;

export function clipDuration(style: ReelStyle, clip: ClipKind, cfg: ClipConfig): number {
  return CLIP_DEFS[style][clip].baseDuration + cfg.hold;
}

/** Animation time: the intro pauses before its wipe; the outro holds its last frame. */
function animTime(clip: ClipKind, base: number, t: number, hold: number): number {
  if (clip === "intro") return t < INTRO_CUT ? t : t < INTRO_CUT + hold ? INTRO_CUT : t - hold;
  return Math.min(t, base - 1 / 30);
}

export function drawClip(
  ctx: CanvasRenderingContext2D,
  style: ReelStyle,
  clip: ClipKind,
  t: number,
  cfg: ClipConfig,
  assets: ReelAssets,
  media: ReelMedia | null,
) {
  const base = CLIP_DEFS[style][clip].baseDuration;
  const args = {
    ctx,
    t: animTime(clip, base, t, cfg.hold),
    tReal: t,
    duration: base + cfg.hold,
    cfg,
    assets,
    media,
  };
  if (style === "brutal") (clip === "intro" ? drawBrutalIntro : drawBrutalOutro)(args);
  else (clip === "intro" ? drawSunsetIntro : drawSunsetOutro)(args);
}

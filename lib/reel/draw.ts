// Canvas helpers for the reel maker (a port of marketing/reels/clips.html).
// All coordinates are in a 1080×1920 frame.

export const W = 1080;
export const H = 1920;
export const FPS = 30;

export const REEL_COLORS = {
  yellow: "#FFE600",
  pink: "#FF2E93",
  cyan: "#00F0FF",
  purple: "#8A2BE2",
} as const;
export type ReelColor = keyof typeof REEL_COLORS;

export const DISPLAY = '"Reel Display", "Archivo Black", Impact, sans-serif';
export const BODY = '"Reel Body", "Space Grotesk", system-ui, sans-serif';

/* ---------- timing ---------- */
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** Progress 0..1 of t within [start, start + dur]. */
export const prog = (t: number, start: number, dur: number) => clamp((t - start) / dur);
export const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
export const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
export const easeInCubic = (x: number) => x ** 3;
export function easeOutBack(x: number): number {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return x <= 0 ? 0 : x >= 1 ? 1 : 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

/* ---------- assets ---------- */
export interface ReelAssets {
  logo: HTMLImageElement;
}

let assets: Promise<ReelAssets> | null = null;

/** Fonts and the logo mark; drawing before these load would use fallback fonts. */
export function loadReelAssets(): Promise<ReelAssets> {
  assets ??= (async () => {
    const fonts = [
      new FontFace("Reel Display", "url(/fonts/ArchivoBlack-Regular.ttf)"),
      new FontFace("Reel Body", "url(/fonts/SpaceGrotesk-Bold.ttf)", { weight: "700" }),
    ];
    await Promise.all(fonts.map(async (f) => document.fonts.add(await f.load())));
    const logo = new Image();
    logo.src = "/logo.svg";
    await logo.decode();
    return { logo };
  })();
  return assets;
}

/* ---------- transforms ---------- */
export interface Tf {
  x?: number;
  y?: number;
  s?: number;
  r?: number;
  o?: number;
}

/** Draw around (cx, cy) with a CSS-like transform (origin at the centre). */
export function at(ctx: CanvasRenderingContext2D, cx: number, cy: number, tf: Tf, draw: () => void) {
  const o = tf.o ?? 1;
  const s = tf.s ?? 1;
  if (o <= 0 || s <= 0) return;
  ctx.save();
  ctx.globalAlpha = o;
  ctx.translate(cx + (tf.x ?? 0), cy + (tf.y ?? 0));
  ctx.rotate(((tf.r ?? 0) * Math.PI) / 180);
  ctx.scale(s, s);
  draw();
  ctx.restore();
}

/** Stamp in: big and invisible → normal size, with overshoot. */
export function stampTf(t: number, start: number, base: Tf = {}): Tf {
  const p = prog(t, start, 0.22);
  return { ...base, s: (base.s ?? 1) * lerp(2.2, 1, easeOutBack(p)), o: p > 0 ? 1 : 0 };
}
/** Pop in from nothing, with overshoot. */
export function popTf(t: number, start: number, base: Tf = {}): Tf {
  const p = prog(t, start, 0.28);
  return { ...base, s: (base.s ?? 1) * easeOutBack(p), o: p > 0 ? 1 : 0 };
}

/* ---------- shapes ---------- */
/** Rectangle centred on the origin, thick black border, hard shadow down-right. */
export function box(ctx: CanvasRenderingContext2D, w: number, h: number, fill: string, border = 10, shadow = 18) {
  const x = -w / 2;
  const y = -h / 2;
  if (shadow) {
    ctx.fillStyle = "#000";
    ctx.fillRect(x + shadow, y + shadow, w, h);
  }
  ctx.fillStyle = "#000";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x + border, y + border, w - border * 2, h - border * 2);
}

export function dots(ctx: CanvasRenderingContext2D, color: string, offsetY = 0) {
  ctx.fillStyle = color;
  ctx.fillRect(0, offsetY, W, H);
  ctx.fillStyle = "rgba(0,0,0,0.13)";
  for (let y = 22; y < H; y += 44) {
    for (let x = 22; x < W; x += 44) {
      ctx.beginPath();
      ctx.arc(x, y + offsetY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/* ---------- text ---------- */
export function setFont(ctx: CanvasRenderingContext2D, size: number, family = DISPLAY) {
  ctx.font = `${family === BODY ? "700 " : ""}${size}px ${family}`;
}

/** Largest size ≤ `size` at which `text` fits in `maxW`. */
export function fitSize(ctx: CanvasRenderingContext2D, text: string, size: number, maxW: number, family = DISPLAY) {
  let s = size;
  setFont(ctx, s, family);
  while (s > 16 && ctx.measureText(text).width > maxW) {
    s -= 2;
    setFont(ctx, s, family);
  }
  return s;
}

export function textWidth(ctx: CanvasRenderingContext2D, text: string, size: number, family = DISPLAY) {
  setFont(ctx, size, family);
  return ctx.measureText(text).width;
}

/** Text centred on the origin. `outline` = white text with a black outline and hard shadow. */
export function text(
  ctx: CanvasRenderingContext2D,
  str: string,
  size: number,
  color: string,
  { family = DISPLAY, outline = 0, shadow = 0 }: { family?: string; outline?: number; shadow?: number } = {},
) {
  setFont(ctx, size, family);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const y = size * 0.04; // optical centring for caps
  if (shadow) {
    ctx.fillStyle = "#000";
    if (outline) {
      ctx.lineWidth = outline * 2;
      ctx.strokeStyle = "#000";
      ctx.strokeText(str, shadow, y + shadow);
    }
    ctx.fillText(str, shadow, y + shadow);
  }
  if (outline) {
    ctx.lineWidth = outline * 2;
    ctx.strokeStyle = "#000";
    ctx.strokeText(str, 0, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, 0, y);
}

/** Bordered box sized to its text, centred on the origin. Returns its size. */
export function sticker(
  ctx: CanvasRenderingContext2D,
  str: string,
  size: number,
  { fill, color = "#000", padX, padY, border = 10, shadow = 18, family = DISPLAY }: {
    fill: string;
    color?: string;
    padX: number;
    padY: number;
    border?: number;
    shadow?: number;
    family?: string;
  },
) {
  const w = textWidth(ctx, str, size, family) + padX * 2 + border * 2;
  const h = size * 0.95 + padY * 2 + border * 2;
  box(ctx, w, h, fill, border, shadow);
  text(ctx, str, size, color, { family });
  return { w, h };
}

export function stickerSize(ctx: CanvasRenderingContext2D, str: string, size: number, padX: number, padY: number, border = 10, family = DISPLAY) {
  return { w: textWidth(ctx, str, size, family) + padX * 2 + border * 2, h: size * 0.95 + padY * 2 + border * 2 };
}

/** "WhatsUpDurbs" + logo mark in a white card, centred on the origin. */
export function logoCard(ctx: CanvasRenderingContext2D, logo: HTMLImageElement, size: number, withMark = true) {
  const a = "WHATSUP";
  const b = "DURBS";
  const wa = textWidth(ctx, a, size);
  const wb = textWidth(ctx, b, size);
  const markH = size * 1.39;
  const markW = withMark ? (markH * 218) / 358 : 0;
  const gap = withMark ? 16 : 0;
  const padX = 34;
  const padY = 18;
  const w = wa + wb + gap + markW + padX * 2 + 20;
  const h = Math.max(size * 0.95, markH) + padY * 2 + 20;
  box(ctx, w, h, "#fff");
  let x = -w / 2 + 10 + padX;
  ctx.save();
  ctx.translate(x + wa / 2, 0);
  text(ctx, a, size, "#000");
  ctx.restore();
  x += wa;
  ctx.save();
  ctx.translate(x + wb / 2, 0);
  text(ctx, b, size, REEL_COLORS.pink);
  ctx.restore();
  x += wb + gap;
  if (withMark) ctx.drawImage(logo, x, -markH / 2, markW, markH);
  return { w, h };
}

/* ---------- colour-bar wipe ---------- */
const BAR_H = Math.ceil(H / 3) + 40;

/** Three bordered bars; `xs` are their horizontal offsets (0 = covering the screen). */
export function bars(ctx: CanvasRenderingContext2D, colors: string[], xs: number[]) {
  colors.forEach((c, i) => {
    const top = i * (BAR_H - 40) - 20;
    ctx.save();
    ctx.translate(xs[i], 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(-40, top, W + 80, BAR_H);
    ctx.fillStyle = c;
    ctx.fillRect(-28, top + 12, W + 56, BAR_H - 24);
    ctx.restore();
  });
}

/** Bars slide in from the right (cover) and later out to the left (uncover), staggered. */
export function barOffsets(t: number, inStart: number, inDur: number, outStart: number, outDur: number) {
  return [0, 1, 2].map((i) => {
    const stagger = i * 0.05;
    const pin = easeOutCubic(prog(t, inStart + stagger, inDur));
    const pout = easeInCubic(prog(t, outStart + stagger, outDur));
    return t < outStart + stagger ? lerp(W + 120, 0, pin) : lerp(0, -W - 120, pout);
  });
}

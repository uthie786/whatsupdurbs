// "Sunset" style: a game-trailer look (sunset sky, striped sun over the sea, palm silhouettes,
// letterbox bars, big glowing gradient titles). Same lengths and cover points as the brutal style.
import {
  BODY,
  CONDENSED,
  H,
  W,
  at,
  clamp,
  easeInCubic,
  easeOutBack,
  easeOutCubic,
  fitSize,
  lerp,
  prog,
  setFont,
  textWidth,
  trackedText,
  wrapWords,
} from "./draw";
import { drawMediaBackground, drawMediaCard, roundRect } from "./media";
import { shown, type FrameArgs } from "./brutal";
import type { TextSlot } from "./types";

const HORIZON = 1180;
const LETTERBOX = 140;
const up = (s: string) => s.trim().toUpperCase();
const scale = (slot: TextSlot) => slot.size / 100;

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5;
  const n = parseInt(m[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/* ---------------- scene ---------------- */
function palm(ctx: CanvasRenderingContext2D, x: number, y: number, height: number, lean: number, sway: number, color: string) {
  const bez = (u: number): [number, number] => {
    const cx = lean * 0.15;
    const cy = -height * 0.55;
    const ex = lean;
    const ey = -height;
    return [2 * (1 - u) * u * cx + u * u * ex, 2 * (1 - u) * u * cy + u * u * ey];
  };
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = "round";
  for (let i = 0; i < 24; i++) {
    const [ax, ay] = bez(i / 24);
    const [bx, by] = bez((i + 1) / 24);
    ctx.lineWidth = lerp(38, 14, i / 24);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
  const [tx, ty] = bez(1);
  ctx.translate(tx, ty);
  ctx.rotate(sway);
  const fronds = [-172, -148, -122, -95, -64, -36, -10, 14];
  fronds.forEach((deg, i) => {
    const a = (deg * Math.PI) / 180;
    const len = height * (0.32 + (i % 3) * 0.04);
    const droop = len * 0.45;
    const ex = Math.cos(a) * len;
    const ey = Math.sin(a) * len + droop;
    const mx = Math.cos(a) * len * 0.5;
    const my = Math.sin(a) * len * 0.5 - len * 0.18;
    const nx = -Math.sin(a) * 22;
    const ny = Math.cos(a) * 22;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(mx + nx, my + ny, ex, ey);
    ctx.quadraticCurveTo(mx - nx, my - ny, 0, 0);
    ctx.fill();
  });
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function scene({ ctx, t, tReal, duration, cfg, media }: FrameArgs) {
  const c = cfg.colors;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  if (media && cfg.media.placement === "background") {
    drawMediaBackground(ctx, media, cfg.media, tReal, duration);
  } else {
    ctx.save();
    // Slow camera push-in.
    const k = 1 + 0.05 * clamp(tReal / Math.max(duration, 0.1));
    ctx.translate(W / 2, H / 2);
    ctx.scale(k, k);
    ctx.translate(-W / 2, -H / 2);

    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, c.skyTop);
    sky.addColorStop(0.6, c.skyMid);
    sky.addColorStop(1, c.horizon);
    ctx.fillStyle = sky;
    ctx.fillRect(-60, -60, W + 120, HORIZON + 60);

    // Stars on dark skies.
    if (luminance(c.skyTop) < 0.25) {
      for (let i = 0; i < 70; i++) {
        const sx = (i * 397) % W;
        const sy = (i * 211) % (HORIZON * 0.55);
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(tReal * 2 + i));
        ctx.fillStyle = `rgba(255,255,255,${0.5 * tw})`;
        ctx.fillRect(sx, sy, 3, 3);
      }
    }

    // Sun rising a little, with a glow and stripes cut through its lower half.
    const sunY = HORIZON - 150 - 50 * easeOutCubic(prog(t, 0, 2.2));
    const r = 290;
    const halo = ctx.createRadialGradient(W / 2, sunY, r * 0.6, W / 2, sunY, r * 1.9);
    halo.addColorStop(0, `${c.sun}88`);
    halo.addColorStop(1, `${c.sun}00`);
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, HORIZON);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, HORIZON);
    ctx.clip();
    const sunFill = ctx.createLinearGradient(0, sunY - r, 0, sunY + r);
    sunFill.addColorStop(0, c.sun);
    sunFill.addColorStop(1, c.horizon);
    ctx.fillStyle = sunFill;
    ctx.beginPath();
    ctx.arc(W / 2, sunY, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = sky; // same gradient as the sky, so the stripes read as gaps
    for (let i = 0; i < 7; i++) {
      const y = sunY + 30 + i * 38;
      ctx.fillRect(W / 2 - r, y, r * 2, 5 + i * 3.5);
    }
    ctx.restore();

    // Sea with shimmering sun reflections.
    const sea = ctx.createLinearGradient(0, HORIZON, 0, H);
    sea.addColorStop(0, c.horizon);
    sea.addColorStop(0.25, c.sea);
    sea.addColorStop(1, "#000000");
    ctx.fillStyle = sea;
    ctx.fillRect(-60, HORIZON, W + 120, H - HORIZON + 60);
    for (let i = 0; i < 16; i++) {
      const y = HORIZON + 14 + i * i * 2.6;
      const w = (320 - i * 16) * (0.85 + 0.15 * Math.sin(tReal * 3 + i * 1.7));
      ctx.fillStyle = c.sun;
      ctx.globalAlpha = Math.max(0, 0.7 - i * 0.04);
      ctx.fillRect(W / 2 - w / 2 + Math.sin(tReal * 2 + i) * 14, y, w, 4 + i * 0.4);
    }
    ctx.globalAlpha = 1;

    // Palm silhouettes, swaying gently.
    const dark = "#0A0414";
    palm(ctx, 70, HORIZON + 330, 1000, 150, Math.sin(tReal * 1.3) * 0.04, dark);
    palm(ctx, 210, HORIZON + 260, 640, 40, Math.sin(tReal * 1.5 + 1) * 0.05, dark);
    palm(ctx, 1010, HORIZON + 330, 1080, -170, Math.sin(tReal * 1.2 + 2) * 0.04, dark);
    ctx.restore();
  }

  // Vignette.
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

function letterbox(ctx: CanvasRenderingContext2D, h: number) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, h);
  ctx.fillRect(0, H - h, W, h);
}

/** Diagonal gradient wipe. `edge` 0 → off the left, 1 → past the right. `cover` paints left of the edge. */
function wipe(ctx: CanvasRenderingContext2D, edge: number, cover: "left" | "right", a: string, b: string) {
  const x = lerp(-420, W + 420, edge);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.beginPath();
  if (cover === "left") {
    ctx.moveTo(-500, 0);
    ctx.lineTo(x + 320, 0);
    ctx.lineTo(x - 320, H);
    ctx.lineTo(-500, H);
  } else {
    ctx.moveTo(x + 320, 0);
    ctx.lineTo(W + 500, 0);
    ctx.lineTo(W + 500, H);
    ctx.lineTo(x - 320, H);
  }
  ctx.closePath();
  ctx.fill();
  // Speed streaks along the leading edge.
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 6;
  for (let i = 0; i < 3; i++) {
    const off = (cover === "left" ? -1 : 1) * (40 + i * 46);
    ctx.beginPath();
    ctx.moveTo(x + 320 + off, 0);
    ctx.lineTo(x - 320 + off, H);
    ctx.stroke();
  }
}

/** Centred text with optional outline and coloured glow. */
function glowText(
  ctx: CanvasRenderingContext2D,
  str: string,
  size: number,
  fill: string | CanvasGradient,
  { family = CONDENSED, stroke, strokeW = 0, glow, blur = 30, shadow = 0 }: {
    family?: string;
    stroke?: string;
    strokeW?: number;
    glow?: string;
    blur?: number;
    shadow?: number;
  } = {},
) {
  setFont(ctx, size, family);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const y = size * 0.05;
  if (shadow) {
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    if (strokeW) {
      ctx.lineWidth = strokeW * 2;
      ctx.strokeStyle = "rgba(0,0,0,0.8)";
      ctx.strokeText(str, shadow, y + shadow);
    }
    ctx.fillText(str, shadow, y + shadow);
  }
  if (glow) {
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = blur;
    ctx.fillStyle = fill;
    ctx.fillText(str, 0, y);
    ctx.restore();
  }
  if (stroke && strokeW) {
    ctx.lineWidth = strokeW * 2;
    ctx.strokeStyle = stroke;
    ctx.strokeText(str, 0, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(str, 0, y);
}

function vGradient(ctx: CanvasRenderingContext2D, size: number, a: string, b: string) {
  const g = ctx.createLinearGradient(0, -size * 0.45, 0, size * 0.45);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}

/** Bright band sliding across already-drawn text (fillText paints only the glyphs). */
function shine(ctx: CanvasRenderingContext2D, str: string, size: number, p: number, family = CONDENSED) {
  if (p <= 0 || p >= 1) return;
  const w = textWidth(ctx, str, size, family);
  const x = lerp(-w * 0.7, w * 0.7, p);
  const g = ctx.createLinearGradient(x - 140, 0, x + 140, 0);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.5, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  setFont(ctx, size, family);
  ctx.fillStyle = g;
  ctx.fillText(str, 0, size * 0.05);
}

/** Two-line title lockup ("WHATSUP" over a big gradient "DURBS"). */
function titleLockup(
  ctx: CanvasRenderingContext2D,
  c: Record<string, string>,
  line1: { str: string; size: number; color: string } | null,
  line2: { str: string; size: number; outline: string } | null,
  gap: number,
  sweep: number,
) {
  if (line1) glowText(ctx, line1.str, line1.size, line1.color, { glow: c.glow, blur: 26, shadow: 6 });
  if (line2) {
    ctx.save();
    ctx.translate(0, gap);
    glowText(ctx, line2.str, line2.size, vGradient(ctx, line2.size, c.titleA, c.titleB), {
      stroke: line2.outline,
      strokeW: Math.max(3, line2.size / 50),
      glow: c.glow,
      blur: 50,
      shadow: 10,
    });
    shine(ctx, line2.str, line2.size, sweep);
    ctx.restore();
  }
}

/* ---------------- intro ---------------- */
export function drawSunsetIntro(args: FrameArgs) {
  const { ctx, t, cfg, media } = args;
  const c = cfg.colors;
  scene(args);
  if (media && cfg.media.placement === "card") drawMediaCard(ctx, media, cfg.media, t, 0.4, "neon", c.glow);

  const t1 = shown(cfg, "title1");
  if (t1) {
    const str = up(t1.text);
    const s = fitSize(ctx, str, 150 * scale(t1), W - 140, CONDENSED);
    const p = prog(t, 0.5, 0.35);
    at(ctx, W / 2 + t1.dx, 700 + t1.dy, { s: lerp(1.5, 1, easeOutCubic(p)), o: p > 0 ? Math.min(1, p * 3) : 0 }, () =>
      glowText(ctx, str, s, t1.color, { glow: c.glow, blur: 26, shadow: 6 }),
    );
  }

  const t2 = shown(cfg, "title2");
  if (t2) {
    const str = up(t2.text);
    const s = fitSize(ctx, str, 300 * scale(t2), W - 120, CONDENSED);
    const p = prog(t, 0.72, 0.45);
    at(ctx, W / 2 + t2.dx, 900 + t2.dy, { s: lerp(0.55, 1, easeOutBack(p)), o: p > 0 ? 1 : 0 }, () =>
      titleLockup(ctx, c, null, { str, size: s, outline: t2.color }, 0, prog(t, 1.15, 0.7)),
    );
  }

  const badge = shown(cfg, "badge");
  if (badge) {
    const str = up(badge.text).slice(0, 4);
    const size = 160 * scale(badge);
    const bw = Math.max(size, textWidth(ctx, str, size * 0.62, CONDENSED) + size * 0.35);
    const p = prog(t, 1.0, 0.3);
    at(ctx, W / 2 + badge.dx, 1110 + badge.dy, { s: easeOutBack(p), r: lerp(-12, 0, easeOutCubic(p)), o: p > 0 ? 1 : 0 }, () => {
      ctx.save();
      ctx.shadowColor = c.glow;
      ctx.shadowBlur = 40;
      const g = ctx.createLinearGradient(-bw / 2, -size / 2, bw / 2, size / 2);
      g.addColorStop(0, c.badgeA);
      g.addColorStop(1, c.badgeB);
      ctx.fillStyle = g;
      roundRect(ctx, -bw / 2, -size / 2, bw, size, size * 0.18);
      ctx.fill();
      ctx.restore();
      glowText(ctx, str, size * 0.62, badge.color, { shadow: 4 });
    });
  }

  const tag = shown(cfg, "tagline");
  if (tag) {
    const str = up(tag.text);
    const p = prog(t, 1.35, 0.5);
    const size = fitSize(ctx, str, 46 * scale(tag), W - 200, BODY);
    const spacing = lerp(36, 12, easeOutCubic(p));
    at(ctx, W / 2 + tag.dx, 1270 + tag.dy, { o: p }, () => {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 12;
      // Shrink the spacing if the tracked line would run off the frame.
      let sp = spacing;
      setFont(ctx, size, BODY);
      const natural = ctx.measureText(str).width;
      if (natural + sp * (str.length - 1) > W - 120) sp = Math.max(2, (W - 120 - natural) / Math.max(1, str.length - 1));
      trackedText(ctx, str, size, tag.color, sp);
      ctx.restore();
    });
  }

  // Letterbox opens like a film, and the wipe covers everything at the end.
  letterbox(ctx, lerp(H / 2, LETTERBOX, easeOutCubic(prog(t, 0, 0.55))));
  const pw = prog(t, 2.55, 0.38);
  if (pw > 0) wipe(ctx, easeInCubic(pw) * 0.5 + pw * 0.5, "left", c.titleA, c.titleB);
}

/* ---------------- outro ---------------- */
export function drawSunsetOutro(args: FrameArgs) {
  const { ctx, t, cfg, media } = args;
  const c = cfg.colors;
  scene(args);
  if (media && cfg.media.placement === "card") drawMediaCard(ctx, media, cfg.media, t, 0.8, "neon", c.glow);

  const banner = shown(cfg, "banner");
  if (banner) {
    const str = up(banner.text);
    const s = fitSize(ctx, str, 190 * scale(banner), W - 120, CONDENSED);
    const p = prog(t, 0.45, 0.25);
    at(ctx, W / 2 + banner.dx, 560 + banner.dy, { s: lerp(2, 1, easeOutBack(p)), r: -3, o: p > 0 ? 1 : 0 }, () =>
      glowText(ctx, str, s, vGradient(ctx, s, c.bannerA ?? "#FFF0A0", c.bannerB ?? "#F2A900"), {
        stroke: banner.color,
        strokeW: Math.max(4, s / 26),
        shadow: 12,
      }),
    );
  }

  const sub = shown(cfg, "sub");
  if (sub) {
    const str = up(sub.text);
    const s = fitSize(ctx, str, 100 * scale(sub), W - 160, CONDENSED);
    const p = easeOutCubic(prog(t, 0.75, 0.3));
    at(ctx, W / 2 + sub.dx, 730 + sub.dy, { x: lerp(-W, 0, p), o: p > 0 ? 1 : 0 }, () =>
      glowText(ctx, str, s, sub.color, { stroke: "#000", strokeW: 5, shadow: 6 }),
    );
  }

  const card = shown(cfg, "card", true);
  if (card) {
    const p = prog(t, 1.0, 0.35);
    at(ctx, W / 2 + card.dx, 860 + card.dy, { s: easeOutBack(p) * scale(card), o: p > 0 ? 1 : 0 }, () =>
      titleLockup(ctx, c, { str: "WHATSUP", size: 72, color: card.color }, { str: "DURBS", size: 150, outline: "#FFFFFF" }, 105, prog(t, 1.4, 0.6)),
    );
  }

  const url = shown(cfg, "url");
  if (url) {
    const str = up(url.text);
    const p = prog(t, 1.25, 0.3);
    const size = fitSize(ctx, str, 40 * scale(url), W - 260, BODY);
    at(ctx, W / 2 + url.dx, 1090 + url.dy, { y: lerp(60, 0, easeOutCubic(p)), o: p }, () => {
      setFont(ctx, size, BODY);
      const w = ctx.measureText(str).width + str.length * 4 + 80;
      const h = size * 2;
      ctx.save();
      ctx.shadowColor = c.glow;
      ctx.shadowBlur = 24;
      ctx.strokeStyle = c.glow;
      ctx.lineWidth = 5;
      roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      trackedText(ctx, str, size, url.color, 4);
    });
  }

  // Neon sign that flickers on.
  const st = shown(cfg, "sticker");
  if (st) {
    const str = up(st.text);
    const s = fitSize(ctx, str, 92 * scale(st), W - 140, CONDENSED);
    const since = t - 1.45;
    const flicker = since < 0 ? 0 : since < 0.35 ? [1, 0.2, 0.9, 0.3, 1, 0.6, 1][Math.floor(since * 20) % 7] : 1;
    at(ctx, W / 2 + st.dx, 1250 + st.dy, { r: -3, o: flicker }, () => {
      setFont(ctx, s, CONDENSED);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.save();
      ctx.shadowColor = st.color;
      ctx.shadowBlur = 36;
      ctx.strokeStyle = st.color;
      ctx.lineWidth = 9;
      ctx.strokeText(str, 0, s * 0.05);
      ctx.restore();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2.5;
      ctx.strokeText(str, 0, s * 0.05);
    });
  }

  const follow = shown(cfg, "follow");
  if (follow) {
    const str = up(follow.text);
    const size = 44 * scale(follow);
    const lines = wrapWords(ctx, str, size, W - 200, BODY).slice(0, 3);
    const p = prog(t, 1.75, 0.4);
    at(ctx, W / 2 + follow.dx, 1420 + follow.dy, { o: p, y: lerp(30, 0, easeOutCubic(p)) }, () => {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = 10;
      lines.forEach((l, i) => {
        ctx.save();
        ctx.translate(0, (i - (lines.length - 1) / 2) * size * 1.15);
        trackedText(ctx, l, size, follow.color, 3);
        ctx.restore();
      });
      ctx.restore();
    });
  }

  letterbox(ctx, LETTERBOX);
  // Starts covered by the wipe (matching the intro's ending), which slides away.
  const pw = prog(t, 0, 0.45);
  if (pw < 1) wipe(ctx, easeInCubic(pw), "right", c.titleA, c.titleB);
}

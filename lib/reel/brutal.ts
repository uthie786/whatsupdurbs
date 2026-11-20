// Neo-brutalist intro and outro. Timings match marketing/reels/clips.html, so the intro still ends
// on colour bars and the outro starts on them (hard cuts line up with the transitions).
import {
  BODY,
  H,
  REEL_COLORS,
  W,
  at,
  barOffsets,
  bars,
  box,
  dots,
  easeOutBack,
  easeOutCubic,
  fitSize,
  lerp,
  logoCard,
  onColor,
  popTf,
  prog,
  stampTf,
  sticker,
  stickerSize,
  text,
  textWidth,
  wrapWords,
  type ReelAssets,
} from "./draw";
import { drawMediaBackground, drawMediaCard, type ReelMedia } from "./media";
import { MAX_CHIPS, type ClipConfig, type TextSlot } from "./types";

export interface FrameArgs {
  ctx: CanvasRenderingContext2D;
  /** Animation time (holds pause it). */
  t: number;
  /** Real time in the clip, for things that keep moving during a hold. */
  tReal: number;
  duration: number;
  cfg: ClipConfig;
  assets: ReelAssets;
  media: ReelMedia | null;
}

const up = (s: string) => s.trim().toUpperCase();
const scale = (slot: TextSlot) => slot.size / 100;

/** The slot if it should be drawn. */
export function shown(cfg: ClipConfig, key: string, fixed = false): TextSlot | null {
  const slot = cfg.slots[key];
  if (!slot || !slot.visible) return null;
  return fixed || slot.text.trim() ? slot : null;
}

const CHIP_COLORS = ["#00F0FF", "#FFFFFF", "#8A2BE2", "#FF8A00", "#FF3B30", "#C084FC", "#FFE600", "#FF2E93"];
const CHIP_ROT = [-5, 4, -3, 3, -4, 5];
const CHIP_JITTER = [0, 30, -20, 10, -10, 20];

/* ---------------- intro ---------------- */
export function drawBrutalIntro({ ctx, t, tReal, duration, cfg, assets, media }: FrameArgs) {
  const bg = cfg.colors.background;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  // Background wipes up from the bottom.
  const bgY = lerp(H, 0, easeOutCubic(prog(t, 0, 0.3)));
  if (media && cfg.media.placement === "background") {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, bgY, W, H);
    ctx.clip();
    drawMediaBackground(ctx, media, cfg.media, tReal, duration);
    ctx.restore();
  } else {
    dots(ctx, bg, bgY);
  }
  if (media && cfg.media.placement === "card") drawMediaCard(ctx, media, cfg.media, t, 0.4, "brutal");

  const logo = shown(cfg, "logo", true);
  if (logo) {
    const pl = prog(t, 0.2, 0.45);
    at(ctx, W / 2 + logo.dx, 374 + logo.dy, { y: lerp(-500, 0, easeOutBack(pl)), r: lerp(-8, -2, pl), s: scale(logo), o: pl > 0 ? 1 : 0 }, () =>
      logoCard(ctx, assets.logo, 66),
    );
  }

  (["line1", "line2"] as const).forEach((key, i) => {
    const slot = shown(cfg, key);
    if (!slot) return;
    const str = up(slot.text);
    const s = fitSize(ctx, str, 190 * scale(slot), W - 160);
    const w = textWidth(ctx, str, s);
    at(ctx, 80 + w / 2 + slot.dx, (i === 0 ? 650 : 840) + slot.dy, stampTf(t, i === 0 ? 0.55 : 0.72), () =>
      text(ctx, str, s, slot.color),
    );
  });

  const hl = shown(cfg, "highlight");
  if (hl) {
    const str = up(hl.text);
    const s = fitSize(ctx, str, 210 * scale(hl), W - 200);
    const { w } = stickerSize(ctx, str, s, 26, 6, 0);
    at(ctx, 70 + w / 2 + hl.dx, 1056 + hl.dy, stampTf(t, 0.9, { r: -2 }), () =>
      sticker(ctx, str, s, { fill: cfg.colors.highlightBlock, color: hl.color, padX: 26, padY: 6, border: 0, shadow: 0 }),
    );
  }

  const st = shown(cfg, "sticker");
  if (st) {
    const str = up(st.text);
    const s = fitSize(ctx, str, 70 * scale(st), W - 200);
    const { w, h } = stickerSize(ctx, str, s, 36, 20);
    const cx = Math.min(Math.max(560 + w / 2, w / 2 + 60), W - 60 - w / 2);
    at(ctx, cx + st.dx, 1210 + h / 2 + st.dy, popTf(t, 1.2, { r: 6 }), () =>
      sticker(ctx, str, s, { fill: cfg.colors.stickerFill, color: st.color, padX: 36, padY: 20 }),
    );
  }

  // Chips pop in, flowing into rows.
  const group = shown(cfg, "chips", true);
  if (group) {
    const palette = CHIP_COLORS.filter((c) => c.toUpperCase() !== bg.toUpperCase());
    const k = scale(group);
    let x = 70;
    let row = 0;
    cfg.chips
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, MAX_CHIPS)
      .forEach((label, i) => {
        const size = fitSize(ctx, label, 42 * k, W - 260, BODY);
        const { w, h } = stickerSize(ctx, label, size, 28, 14, 8, BODY);
        if (x + w > W - 60 && x > 70) {
          row += 1;
          x = 70 + (row % 2 ? 50 : 0);
        }
        const fill = palette[i % palette.length];
        const cy = 1420 + row * 140 * k + CHIP_JITTER[i % CHIP_JITTER.length] + h / 2;
        at(ctx, x + w / 2 + group.dx, cy + group.dy, popTf(t, 1.4 + i * 0.08, { r: CHIP_ROT[i % CHIP_ROT.length] }), () =>
          sticker(ctx, label, size, { fill, color: onColor(fill), padX: 28, padY: 14, border: 8, shadow: 12, family: BODY }),
        );
        x += w + 34;
      });
  }

  // Bars cover the screen by the end, ready for a hard cut to the first event.
  bars(ctx, [REEL_COLORS.pink, REEL_COLORS.cyan, REEL_COLORS.yellow], barOffsets(t, 2.55, 0.3, 99, 1));
}

/* ---------------- outro ---------------- */
export function drawBrutalOutro({ ctx, t, tReal, duration, cfg, assets, media }: FrameArgs) {
  if (media && cfg.media.placement === "background") drawMediaBackground(ctx, media, cfg.media, tReal, duration);
  else dots(ctx, cfg.colors.background);
  if (media && cfg.media.placement === "card") drawMediaCard(ctx, media, cfg.media, t, 0.8, "brutal");

  (["line1", "line2"] as const).forEach((key, i) => {
    const slot = shown(cfg, key);
    if (!slot) return;
    const str = up(slot.text);
    const s = fitSize(ctx, str, 150 * scale(slot), W - 170);
    const w = textWidth(ctx, str, s);
    at(ctx, 80 + w / 2 + slot.dx, (i === 0 ? 401 : 551) + slot.dy, stampTf(t, i === 0 ? 0.35 : 0.5), () =>
      text(ctx, str, s, slot.color, { outline: 4, shadow: 12 }),
    );
  });

  const card = shown(cfg, "card", true);
  if (card) {
    at(ctx, W / 2 + card.dx, 786 + card.dy, popTf(t, 0.7, { r: -2, s: scale(card) }), () => {
      box(ctx, W - 160, 172, "#fff");
      const a = "WHATSUP";
      const b = "DURBS";
      const wa = textWidth(ctx, a, 88);
      const wb = textWidth(ctx, b, 88);
      ctx.save();
      ctx.translate(-(wa + wb) / 2 + wa / 2, 0);
      text(ctx, a, 88, "#000");
      ctx.translate(wa / 2 + wb / 2, 0);
      text(ctx, b, 88, REEL_COLORS.pink);
      ctx.restore();
    });
  }

  const url = shown(cfg, "url");
  if (url) {
    const pu = prog(t, 0.95, 0.25);
    const str = up(url.text);
    const s = fitSize(ctx, str, 52 * scale(url), W - 200);
    at(ctx, W / 2 + url.dx, 977 + url.dy, { y: lerp(80, 0, easeOutBack(pu)), o: pu > 0 ? 1 : 0 }, () => {
      const w = textWidth(ctx, str, s) + 52;
      const h = s * 1.4;
      ctx.fillStyle = cfg.colors.urlBar;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      text(ctx, str, s, url.color);
    });
  }

  const st = shown(cfg, "sticker");
  if (st) {
    const str = up(st.text);
    const s = fitSize(ctx, str, 58 * scale(st), W - 200);
    const { w, h } = stickerSize(ctx, str, s, 34, 22);
    at(ctx, 90 + w / 2 + st.dx, 1150 + h / 2 + st.dy, popTf(t, 1.2, { r: -4 }), () =>
      sticker(ctx, str, s, { fill: cfg.colors.stickerFill, color: st.color, padX: 34, padY: 22 }),
    );
  }

  const mark = shown(cfg, "mark", true);
  if (mark) {
    const pm = prog(t, 1.4, 0.4);
    at(ctx, W - 196 + mark.dx, 1455 + mark.dy, { s: easeOutBack(pm) * scale(mark), r: lerp(-200, 8, easeOutCubic(pm)), o: pm > 0 ? 1 : 0 }, () =>
      ctx.drawImage(assets.logo, -76, -125, 152, 250),
    );
  }

  // Bottom line, wrapped beside the logo mark: biggest size that fits in three lines.
  const follow = shown(cfg, "follow");
  if (follow) {
    const str = up(follow.text);
    let s = 60 * scale(follow);
    let lines = wrapWords(ctx, str, s, 560);
    while (s > 24 && (lines.length > 3 || lines.some((l) => textWidth(ctx, l, s) > 600))) {
      s -= 4;
      lines = wrapWords(ctx, str, s, 560);
    }
    const lh = s * 0.95;
    const widest = Math.max(...lines.map((l) => textWidth(ctx, l, s)));
    at(ctx, 90 + widest / 2 + follow.dx, 1400 + (lh * lines.length) / 2 + follow.dy, stampTf(t, 1.7), () => {
      lines.forEach((l, i) => {
        const lw = textWidth(ctx, l, s);
        ctx.save();
        ctx.translate(-widest / 2 + lw / 2, -((lines.length - 1) * lh) / 2 + i * lh);
        text(ctx, l, s, follow.color, { outline: 2 });
        ctx.restore();
      });
    });
  }

  // Bars start covering (continuing from the last transition) and slide away.
  bars(ctx, [REEL_COLORS.yellow, REEL_COLORS.cyan, REEL_COLORS.pink], barOffsets(t, -1, 0.01, 0, 0.35));
}

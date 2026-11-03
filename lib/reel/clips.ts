// Customisable intro and outro for reels. Timings match marketing/reels/clips.html, so the
// intro still ends on colour bars and the outro starts on them (hard cuts line up).
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
  popTf,
  prog,
  stampTf,
  sticker,
  stickerSize,
  text,
  textWidth,
  type ReelAssets,
  type ReelColor,
} from "./draw";

export const INTRO_DURATION = 3.0;
export const OUTRO_DURATION = 3.6;

export interface IntroConfig {
  color: ReelColor;
  /** Three headline lines; the third sits on a black block. Empty lines are skipped. */
  lines: [string, string, string];
  sticker: string;
  chips: string[];
}

export interface OutroConfig {
  color: ReelColor;
  lines: [string, string];
  sticker: string;
  follow: string;
}

export const MAX_CHIPS = 6;

export const DEFAULT_INTRO: IntroConfig = {
  color: "yellow",
  lines: ["What's", "on this", "week"],
  sticker: "Durban 🌊",
  chips: ["🛍️ Markets", "🎤 Gigs", "🪩 Parties", "🏃 Park runs", "🚗 Car meets"],
};

export const DEFAULT_OUTRO: OutroConfig = {
  color: "pink",
  lines: ["Find more", "jols on"],
  sticker: "List your event free ⚡",
  follow: "Follow for weekly jols 👀",
};

const up = (s: string) => s.trim().toUpperCase();
/** Sticker colour that stands out from the background, and readable text on it. */
const stickerFill = (bg: ReelColor) => (bg === "pink" ? REEL_COLORS.yellow : REEL_COLORS.pink);
const onFill = (fill: string) => ([REEL_COLORS.pink, REEL_COLORS.purple, "#FF3B30"] as string[]).includes(fill) ? "#fff" : "#000";

const CHIP_COLORS = ["#00F0FF", "#FFFFFF", "#8A2BE2", "#FF8A00", "#FF3B30", "#C084FC", "#FFE600", "#FF2E93"];
const CHIP_ROT = [-5, 4, -3, 3, -4, 5];
const CHIP_JITTER = [0, 30, -20, 10, -10, 20];

/* ---------------- intro ---------------- */
export function drawIntro(ctx: CanvasRenderingContext2D, t: number, cfg: IntroConfig, { logo }: ReelAssets) {
  const bg = REEL_COLORS[cfg.color];
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  // Background wipes up from the bottom.
  dots(ctx, bg, lerp(H, 0, easeOutCubic(prog(t, 0, 0.3))));

  // Logo card drops in.
  const pl = prog(t, 0.2, 0.45);
  at(ctx, W / 2, 374, { y: lerp(-500, 0, easeOutBack(pl)), r: lerp(-8, -2, pl), o: pl > 0 ? 1 : 0 }, () =>
    logoCard(ctx, logo, 66),
  );

  // Headline: two plain lines and a highlighted third line.
  const [l1, l2, l3] = cfg.lines.map(up);
  if (l1) {
    const s = fitSize(ctx, l1, 190, W - 160);
    const w = textWidth(ctx, l1, s);
    at(ctx, 80 + w / 2, 650, stampTf(t, 0.55), () => text(ctx, l1, s, "#000"));
  }
  if (l2) {
    const s = fitSize(ctx, l2, 190, W - 160);
    const w = textWidth(ctx, l2, s);
    at(ctx, 80 + w / 2, 840, stampTf(t, 0.72), () => text(ctx, l2, s, "#000"));
  }
  if (l3) {
    const s = fitSize(ctx, l3, 210, W - 200);
    const { w } = stickerSize(ctx, l3, s, 26, 6, 0);
    const color = cfg.color === "purple" ? REEL_COLORS.yellow : bg;
    at(ctx, 70 + w / 2, 1056, stampTf(t, 0.9, { r: -2 }), () =>
      sticker(ctx, l3, s, { fill: "#000", color, padX: 26, padY: 6, border: 0, shadow: 0 }),
    );
  }

  // Sticker slaps on.
  const st = up(cfg.sticker);
  if (st) {
    const fill = stickerFill(cfg.color);
    const s = fitSize(ctx, st, 70, W - 200);
    const { w, h } = stickerSize(ctx, st, s, 36, 20);
    const cx = Math.min(Math.max(560 + w / 2, w / 2 + 60), W - 60 - w / 2);
    at(ctx, cx, 1210 + h / 2, popTf(t, 1.2, { r: 6 }), () =>
      sticker(ctx, st, s, { fill, color: onFill(fill), padX: 36, padY: 20 }),
    );
  }

  // Chips pop in, flowing into rows.
  const palette = CHIP_COLORS.filter((c) => c.toUpperCase() !== bg.toUpperCase());
  let x = 70;
  let row = 0;
  cfg.chips
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, MAX_CHIPS)
    .forEach((label, i) => {
      const size = fitSize(ctx, label, 42, W - 260, BODY);
      const { w, h } = stickerSize(ctx, label, size, 28, 14, 8, BODY);
      if (x + w > W - 60 && x > 70) {
        row += 1;
        x = 70 + (row % 2 ? 50 : 0);
      }
      const fill = palette[i % palette.length];
      const cx = x + w / 2;
      const cy = 1420 + row * 140 + CHIP_JITTER[i % CHIP_JITTER.length] + h / 2;
      at(ctx, cx, cy, popTf(t, 1.4 + i * 0.08, { r: CHIP_ROT[i % CHIP_ROT.length] }), () =>
        sticker(ctx, label, size, { fill, color: onFill(fill), padX: 28, padY: 14, border: 8, shadow: 12, family: BODY }),
      );
      x += w + 34;
    });

  // Bars cover the screen by the end, ready for a hard cut to the first event.
  bars(ctx, [REEL_COLORS.pink, REEL_COLORS.cyan, REEL_COLORS.yellow], barOffsets(t, 2.55, 0.3, 99, 1));
}

/* ---------------- outro ---------------- */
/** Greedy word wrap; anything past `maxLines` stays on the last line. */
function wrap(ctx: CanvasRenderingContext2D, str: string, size: number, maxW: number, maxLines: number): string[] {
  const words = str.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(ctx, next, size) > maxW && lines.length < maxLines - 1) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function drawOutro(ctx: CanvasRenderingContext2D, t: number, cfg: OutroConfig, { logo }: ReelAssets) {
  const bg = REEL_COLORS[cfg.color];
  dots(ctx, bg);

  const [l1, l2] = cfg.lines.map(up);
  [l1, l2].forEach((line, i) => {
    if (!line) return;
    const s = fitSize(ctx, line, 150, W - 170);
    const w = textWidth(ctx, line, s);
    at(ctx, 80 + w / 2, i === 0 ? 401 : 551, stampTf(t, i === 0 ? 0.35 : 0.5), () =>
      text(ctx, line, s, "#fff", { outline: 4, shadow: 12 }),
    );
  });

  // Site name card.
  at(ctx, W / 2, 786, popTf(t, 0.7, { r: -2 }), () => {
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

  // Web address bar.
  const pu = prog(t, 0.95, 0.25);
  at(ctx, W / 2, 977, { y: lerp(80, 0, easeOutBack(pu)), o: pu > 0 ? 1 : 0 }, () => {
    const url = "WHATSUPDURBS.VERCEL.APP";
    const w = textWidth(ctx, url, 52) + 52;
    ctx.fillStyle = "#000";
    ctx.fillRect(-w / 2, -36, w, 72);
    text(ctx, url, 52, REEL_COLORS.yellow);
  });

  // Sticker.
  const st = up(cfg.sticker);
  if (st) {
    const fill = cfg.color === "yellow" ? REEL_COLORS.cyan : REEL_COLORS.yellow;
    const s = fitSize(ctx, st, 58, W - 200);
    const { w, h } = stickerSize(ctx, st, s, 34, 22);
    at(ctx, 90 + w / 2, 1150 + h / 2, popTf(t, 1.2, { r: -4 }), () =>
      sticker(ctx, st, s, { fill, color: onFill(fill), padX: 34, padY: 22 }),
    );
  }

  // Logo mark spins in.
  const pm = prog(t, 1.4, 0.4);
  at(ctx, W - 120 - 76, 1455, { s: easeOutBack(pm), r: lerp(-200, 8, easeOutCubic(pm)), o: pm > 0 ? 1 : 0 }, () =>
    ctx.drawImage(logo, -76, -125, 152, 250),
  );

  // "Follow for…" line, wrapped beside the logo mark.
  const follow = up(cfg.follow);
  if (follow) {
    // Biggest size at which it wraps into at most three lines beside the logo mark.
    let s = 60;
    let lines = wrap(ctx, follow, s, 560, 99);
    while (s > 30 && (lines.length > 3 || lines.some((l) => textWidth(ctx, l, s) > 600))) {
      s -= 4;
      lines = wrap(ctx, follow, s, 560, 99);
    }
    const lh = s * 0.95;
    const widest = Math.max(...lines.map((l) => textWidth(ctx, l, s)));
    at(ctx, 90 + widest / 2, 1400 + (lh * lines.length) / 2, stampTf(t, 1.7), () => {
      lines.forEach((l, i) => {
        const lw = textWidth(ctx, l, s);
        ctx.save();
        ctx.translate(-widest / 2 + lw / 2, -((lines.length - 1) * lh) / 2 + i * lh);
        text(ctx, l, s, "#fff", { outline: 2 });
        ctx.restore();
      });
    });
  }

  // Bars start covering (continuing from the last transition) and slide away.
  bars(ctx, [REEL_COLORS.yellow, REEL_COLORS.cyan, REEL_COLORS.pink], barOffsets(t, -1, 0.01, 0, 0.35));
}


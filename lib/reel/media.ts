// Pictures and videos added to a reel clip. They stay in the browser (object URLs); nothing is uploaded.
import type { MediaSettings } from "./types";
import { H, W, box, easeOutBack, prog } from "./draw";

export interface ReelMedia {
  kind: "image" | "video";
  el: HTMLImageElement | HTMLVideoElement;
  width: number;
  height: number;
  name: string;
  url: string;
}

export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

export async function loadMedia(file: File): Promise<ReelMedia> {
  if (file.size > MAX_MEDIA_BYTES) throw new Error("That file is over 50 MB. Try a shorter clip or a smaller picture.");
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.loop = true;
      v.preload = "auto";
      v.crossOrigin = "anonymous";
      v.src = url;
      await new Promise<void>((resolve, reject) => {
        v.onloadeddata = () => resolve();
        v.onerror = () => reject(new Error("This browser can't play that video. Try an MP4."));
      });
      return { kind: "video", el: v, width: v.videoWidth, height: v.videoHeight, name: file.name, url };
    }
    if (!file.type.startsWith("image/")) throw new Error("Choose a picture or a video.");
    const img = new Image();
    img.src = url;
    await img.decode();
    return { kind: "image", el: img, width: img.naturalWidth, height: img.naturalHeight, name: file.name, url };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

export function releaseMedia(m: ReelMedia | null | undefined) {
  if (!m) return;
  if (m.kind === "video") (m.el as HTMLVideoElement).pause();
  URL.revokeObjectURL(m.url);
}

/** Put a video on the frame for time t (looping), for frame-exact exports. */
export async function seekMedia(m: ReelMedia | null | undefined, t: number): Promise<void> {
  if (!m || m.kind !== "video") return;
  const v = m.el as HTMLVideoElement;
  const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 1;
  const target = Math.min(t % d, Math.max(0, d - 0.04));
  if (Math.abs(v.currentTime - target) < 0.001) return;
  await new Promise<void>((resolve) => {
    const done = () => {
      v.removeEventListener("seeked", done);
      resolve();
    };
    v.addEventListener("seeked", done);
    v.currentTime = target;
    setTimeout(done, 1500); // never hang an export on a stubborn decoder
  });
}

/** Draw the media scaled to cover a w×h box centred on the origin. */
function cover(ctx: CanvasRenderingContext2D, m: ReelMedia, w: number, h: number, zoom: number) {
  const s = Math.max(w / m.width, h / m.height) * zoom;
  const dw = m.width * s;
  const dh = m.height * s;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-w / 2, -h / 2, w, h);
  ctx.clip();
  ctx.drawImage(m.el, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

/** Full-frame background with a slow push-in and a darkening layer. */
export function drawMediaBackground(
  ctx: CanvasRenderingContext2D,
  m: ReelMedia,
  s: MediaSettings,
  t: number,
  duration: number,
  offsetY = 0,
) {
  ctx.save();
  ctx.translate(W / 2, H / 2 + offsetY);
  cover(ctx, m, W, H, (s.zoom / 100) * (1 + 0.05 * Math.min(1, t / Math.max(duration, 0.1))));
  ctx.fillStyle = `rgba(0,0,0,${s.dim / 100})`;
  ctx.fillRect(-W / 2, -H / 2, W, H);
  ctx.restore();
}

/** Framed picture/video that pops in at `start`. */
export function drawMediaCard(
  ctx: CanvasRenderingContext2D,
  m: ReelMedia,
  s: MediaSettings,
  t: number,
  start: number,
  frame: "brutal" | "neon",
  glow = "#FF4FD8",
) {
  const p = easeOutBack(prog(t, start, 0.35));
  if (p <= 0) return;
  const w = (W * s.cardSize) / 100;
  const h = Math.min(H * 0.6, (w * m.height) / m.width);
  ctx.save();
  ctx.translate(W / 2, H / 2 + s.cardY);
  ctx.rotate((frame === "brutal" ? -2 : 0) * (Math.PI / 180));
  ctx.scale(p, p);
  if (frame === "brutal") {
    box(ctx, w + 20, h + 20, "#000");
    cover(ctx, m, w, h, s.zoom / 100);
  } else {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 40;
    ctx.strokeStyle = glow;
    ctx.lineWidth = 10;
    roundRect(ctx, -w / 2 - 8, -h / 2 - 8, w + 16, h + 16, 28);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.save();
    roundRect(ctx, -w / 2, -h / 2, w, h, 22);
    ctx.clip();
    cover(ctx, m, w, h, s.zoom / 100);
    ctx.restore();
  }
  ctx.restore();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

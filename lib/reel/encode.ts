// Renders a canvas animation to a video file in the browser.
import { FPS, H, W } from "./draw";

export interface RenderedVideo {
  blob: Blob;
  /** "mp4", or "webm" when the browser can only record WebM. */
  ext: "mp4" | "webm";
}

/**
 * Draw every frame of `draw(ctx, t)` and encode it. Uses WebCodecs + Mediabunny for a frame-exact
 * H.264 MP4 where available; otherwise records the canvas in real time with MediaRecorder.
 */
export async function renderToVideo(
  draw: (ctx: CanvasRenderingContext2D, t: number) => void,
  duration: number,
  onProgress: (fraction: number) => void,
): Promise<RenderedVideo> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't draw the video.");
  const frames = Math.round(duration * FPS);

  const mb = await import("mediabunny");
  if (typeof VideoEncoder !== "undefined" && (await mb.canEncodeVideo("avc", { width: W, height: H }))) {
    const output = new mb.Output({
      format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new mb.BufferTarget(),
    });
    const source = new mb.CanvasSource(canvas, { codec: "avc", quality: mb.QUALITY_HIGH, keyFrameInterval: 1 });
    output.addVideoTrack(source, { frameRate: FPS });
    await output.start();
    for (let i = 0; i < frames; i++) {
      draw(ctx, i / FPS);
      await source.add(i / FPS, 1 / FPS);
      onProgress((i + 1) / frames);
    }
    await output.finalize();
    const buffer = output.target.buffer;
    if (!buffer) throw new Error("Encoding produced no data.");
    return { blob: new Blob([buffer], { type: "video/mp4" }), ext: "mp4" };
  }

  return recordRealtime(canvas, ctx, draw, duration, onProgress);
}

function recordRealtime(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  draw: (ctx: CanvasRenderingContext2D, t: number) => void,
  duration: number,
  onProgress: (fraction: number) => void,
): Promise<RenderedVideo> {
  if (typeof MediaRecorder === "undefined" || !canvas.captureStream) {
    return Promise.reject(new Error("This browser can't make videos. Try Chrome or an up-to-date Safari."));
  }
  const type = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find((t) =>
    MediaRecorder.isTypeSupported(t),
  );
  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      const mime = recorder.mimeType || type || "video/webm";
      resolve({ blob: new Blob(chunks, { type: mime }), ext: mime.includes("mp4") ? "mp4" : "webm" });
    };
    recorder.onerror = () => reject(new Error("Recording failed."));
    draw(ctx, 0);
    recorder.start();
    const started = performance.now();
    const tick = () => {
      const t = (performance.now() - started) / 1000;
      draw(ctx, Math.min(t, duration));
      onProgress(Math.min(1, t / duration));
      if (t < duration + 0.1) requestAnimationFrame(tick);
      else recorder.stop();
    };
    requestAnimationFrame(tick);
  });
}

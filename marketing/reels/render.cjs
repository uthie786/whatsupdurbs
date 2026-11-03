// Renders the WhatsUpDurbs reel clips in clips.html to video.
//   node marketing/reels/render.cjs [outDir] [clipName ...]
// Needs Playwright (with Chromium) and ffmpeg on the PATH.
const { chromium } = require("playwright");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const FPS = 30;
const GREEN = "0x00FF00";
const here = __dirname;
const outDir = path.resolve(process.argv[2] || path.join(here, "out"));
const only = process.argv.slice(3);

function ffmpeg(args) {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  const url = (clip) => `file://${path.join(here, "clips.html")}?clip=${clip}`;

  await page.goto(url("intro"));
  const all = await page.evaluate(() => window.CLIP.all);

  for (const name of only.length ? only : all) {
    await page.goto(url(name));
    await page.evaluate(() => document.fonts.ready);
    const { duration, transparent } = await page.evaluate(() => window.CLIP);
    const frames = Math.round(duration * FPS);
    const dir = fs.mkdtempSync(path.join(outDir, `.frames-${name}-`));
    for (let i = 0; i < frames; i++) {
      await page.evaluate((t) => window.render(t), i / FPS);
      await page.screenshot({ path: path.join(dir, `f${String(i).padStart(4, "0")}.png`), omitBackground: transparent });
    }
    const input = ["-framerate", String(FPS), "-i", path.join(dir, "f%04d.png")];
    const h264 = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-movflags", "+faststart"];
    if (transparent) {
      // Green-screen MP4 for CapCut's chroma key, and a ProRes 4444 MOV with real transparency.
      ffmpeg([
        "-f", "lavfi", "-i", `color=${GREEN}:s=1080x1920:r=${FPS}`, ...input,
        "-filter_complex", "[0][1]overlay=shortest=1", ...h264, path.join(outDir, `${name}-greenscreen.mp4`),
      ]);
      ffmpeg([...input, "-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le", path.join(outDir, `${name}-alpha.mov`)]);
    } else {
      ffmpeg([...input, ...h264, path.join(outDir, `${name}.mp4`)]);
    }
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`${name}: ${frames} frames`);
  }
  await browser.close();
})();

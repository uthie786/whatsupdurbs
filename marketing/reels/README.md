# Reel asset pack

Animated intro, outro, transitions and an overlay for Instagram Reels, in the WhatsUpDurbs style.
See `HOW-TO-USE.txt` for editing them together in CapCut.

The intro and outro can also be customised (headline, sticker, chips, outro lines, colour) and exported as
MP4 in the browser at **`/admin/reel`** (`app/admin/reel/page.tsx`, drawing code in `lib/reel/`). Keep its
timings in sync with `clips.html` so the bars still cover the cut points.

- `clips.html` holds every animation. Each clip has a `setup()` and a `render(t)` (t in seconds), so
  frames are exact. Open it in a browser with `?clip=intro` and run `render(1.2)` in the console to preview a moment.
- `render.cjs` steps through each clip at 30 fps with Playwright and encodes it with ffmpeg:

```bash
node marketing/reels/render.cjs                         # all clips → marketing/reels/out/
node marketing/reels/render.cjs ~/Desktop/reels outro   # just the outro, somewhere else
```

Needs [Playwright](https://playwright.dev) with Chromium (`npm i -D playwright && npx playwright install chromium`)
and `ffmpeg` on your PATH. They aren't app dependencies. Change wording, colours or timing in `clips.html` and re-run.

Full-screen clips (intro, outro) are written as H.264 MP4. Clips with transparency are written twice:
`-greenscreen.mp4` (for chroma key on phones) and `-alpha.mov` (ProRes 4444 with an alpha channel).

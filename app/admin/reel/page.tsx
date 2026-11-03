"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clapperboard, Download, Loader2, Plus, RotateCcw, Share2, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import { EVENT_CATEGORIES } from "@/types/event";
import { categoryLabel } from "@/lib/areas";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { H, REEL_COLORS, W, loadReelAssets, type ReelAssets, type ReelColor } from "@/lib/reel/draw";
import {
  DEFAULT_INTRO,
  DEFAULT_OUTRO,
  INTRO_DURATION,
  MAX_CHIPS,
  OUTRO_DURATION,
  drawIntro,
  drawOutro,
  type IntroConfig,
  type OutroConfig,
} from "@/lib/reel/clips";
import { renderToVideo, type RenderedVideo } from "@/lib/reel/encode";

type Clip = "intro" | "outro";
const STORAGE_KEY = "whatsupdurbs-reel-maker-v1";
const COLOR_LABELS: Record<ReelColor, string> = { yellow: "Yellow", pink: "Pink", cyan: "Cyan", purple: "Purple" };
/** Pause on the last frame before the preview loops. */
const PREVIEW_HOLD = 0.8;

function loadSaved(): { intro: IntroConfig; outro: OutroConfig } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<{ intro: IntroConfig; outro: OutroConfig }>;
      return { intro: { ...DEFAULT_INTRO, ...saved.intro }, outro: { ...DEFAULT_OUTRO, ...saved.outro } };
    }
  } catch {
    // Private mode or bad data: start from the defaults.
  }
  return { intro: DEFAULT_INTRO, outro: DEFAULT_OUTRO };
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "reel";
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="font-display text-xs uppercase">{label}</span>
      {children}
      {hint && <span className="block text-xs font-semibold text-neutral-600">{hint}</span>}
    </label>
  );
}

function ColorPicker({ value, onChange }: { value: ReelColor; onChange: (c: ReelColor) => void }) {
  return (
    <div className="space-y-1">
      <span className="font-display text-xs uppercase">Background</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Background colour">
        {(Object.keys(REEL_COLORS) as ReelColor[]).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={value === c}
            onClick={() => onChange(c)}
            className="brutal-chip inline-flex items-center gap-1.5"
          >
            <span className="h-4 w-4 border-2 border-black" style={{ backgroundColor: REEL_COLORS[c] }} />
            {COLOR_LABELS[c]}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ReelMakerPage() {
  const [authed, setAuthed] = useState<boolean | null>(isSupabaseConfigured ? null : true);
  const [clip, setClip] = useState<Clip>("intro");
  const [intro, setIntro] = useState<IntroConfig>(DEFAULT_INTRO);
  const [outro, setOutro] = useState<OutroConfig>(DEFAULT_OUTRO);
  const [loaded, setLoaded] = useState(false);
  const [assets, setAssets] = useState<ReelAssets | null>(null);
  const [chipDraft, setChipDraft] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [video, setVideo] = useState<(RenderedVideo & { url: string; name: string; file: File }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startRef = useRef(0);
  const configRef = useRef({ clip, intro, outro });
  configRef.current = { clip, intro, outro };

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
  }, []);

  useEffect(() => {
    const saved = loadSaved();
    setIntro(saved.intro);
    setOutro(saved.outro);
    setLoaded(true);
    loadReelAssets().then(setAssets, (e: unknown) => setError(errorMessage(e, "Couldn't load the fonts.")));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ intro, outro }));
    } catch {
      // Not saved; the settings still work for this visit.
    }
  }, [intro, outro, loaded]);

  // A new edit makes the last video stale.
  useEffect(() => setVideo(null), [clip, intro, outro]);
  useEffect(() => () => {
    if (video) URL.revokeObjectURL(video.url);
  }, [video]);

  // Live preview loop.
  useEffect(() => {
    if (!assets || !authed) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    startRef.current = performance.now();
    const tick = () => {
      const { clip: c, intro: i, outro: o } = configRef.current;
      const duration = c === "intro" ? INTRO_DURATION : OUTRO_DURATION;
      const t = ((performance.now() - startRef.current) / 1000) % (duration + PREVIEW_HOLD);
      const at = Math.min(t, duration - 1 / 30);
      if (c === "intro") drawIntro(ctx, at, i, assets);
      else drawOutro(ctx, at, o, assets);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [assets, authed]);

  const replay = () => {
    startRef.current = performance.now();
  };

  const switchClip = (c: Clip) => {
    setClip(c);
    replay();
  };

  async function makeVideo() {
    if (!assets) return;
    setError(null);
    setProgress(0);
    try {
      const result =
        clip === "intro"
          ? await renderToVideo((ctx, t) => drawIntro(ctx, t, intro, assets), INTRO_DURATION, setProgress)
          : await renderToVideo((ctx, t) => drawOutro(ctx, t, outro, assets), OUTRO_DURATION, setProgress);
      const name = `whatsupdurbs-${clip}-${slug(clip === "intro" ? intro.lines.join(" ") : outro.lines.join(" "))}.${result.ext}`;
      const file = new File([result.blob], name, { type: result.blob.type });
      setCanShare(typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }));
      setVideo({ ...result, url: URL.createObjectURL(result.blob), name, file });
    } catch (e) {
      setError(errorMessage(e, "Couldn't make the video."));
    } finally {
      setProgress(null);
    }
  }

  const setIntroLine = (i: number, v: string) => {
    const lines = [...intro.lines] as IntroConfig["lines"];
    lines[i] = v;
    setIntro({ ...intro, lines });
  };
  const setOutroLine = (i: number, v: string) => {
    const lines = [...outro.lines] as OutroConfig["lines"];
    lines[i] = v;
    setOutro({ ...outro, lines });
  };
  const addChip = (label: string) => {
    const v = label.trim();
    if (!v || intro.chips.length >= MAX_CHIPS || intro.chips.includes(v)) return;
    setIntro({ ...intro, chips: [...intro.chips, v] });
    setChipDraft("");
  };
  const removeChip = (label: string) => setIntro({ ...intro, chips: intro.chips.filter((c) => c !== label) });
  const suggestions = EVENT_CATEGORIES.map(categoryLabel).filter((c) => !intro.chips.includes(c));

  const download = () => {
    if (!video) return;
    const a = document.createElement("a");
    a.href = video.url;
    a.download = video.name;
    a.click();
  };

  return (
    <>
      <Navbar compact />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm font-black uppercase underline decoration-2 underline-offset-4">
          <ArrowLeft className="h-4 w-4" /> Admin
        </Link>
        <div className="space-y-2">
          <span className="brutal-badge bg-durbs-purple text-white">Reels</span>
          <h1 className="font-display text-4xl uppercase leading-none">Reel maker</h1>
          <p className="max-w-2xl font-semibold">
            Customise the animated intro and outro, preview them, then download a 1080×1920 video for CapCut or
            Instagram. Transitions are in the reel pack.
          </p>
        </div>

        {authed === null && <Loader2 className="h-8 w-8 animate-spin" />}
        {authed === false && (
          <p className="border-3 border-black bg-durbs-yellow px-4 py-3 font-bold shadow-brutal">
            Sign in on the <Link href="/admin" className="underline">admin page</Link> first.
          </p>
        )}

        {authed && (
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-5">
              <div className="flex gap-3" role="tablist">
                {(["intro", "outro"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={clip === c}
                    onClick={() => switchClip(c)}
                    className={`brutal-btn ${clip === c ? "bg-durbs-pink text-white" : "bg-white"}`}
                  >
                    {c === "intro" ? "Intro" : "Outro"}
                  </button>
                ))}
              </div>

              <div className="space-y-4 border-4 border-black bg-white p-4 shadow-brutal-lg">
                {clip === "intro" ? (
                  <>
                    <ColorPicker value={intro.color} onChange={(color) => setIntro({ ...intro, color })} />
                    <div className="grid gap-3 sm:grid-cols-3">
                      {["Headline line 1", "Headline line 2", "Line 3 (highlighted)"].map((label, i) => (
                        <Field key={label} label={label}>
                          <input
                            value={intro.lines[i]}
                            maxLength={16}
                            onChange={(e) => setIntroLine(i, e.target.value)}
                            className="brutal-input"
                          />
                        </Field>
                      ))}
                    </div>
                    <Field label="Sticker" hint="e.g. Durban 🌊, Ballito ☀️, This Saturday">
                      <input
                        value={intro.sticker}
                        maxLength={24}
                        onChange={(e) => setIntro({ ...intro, sticker: e.target.value })}
                        className="brutal-input"
                      />
                    </Field>
                    <div className="space-y-2">
                      <span className="font-display text-xs uppercase">
                        Chips ({intro.chips.length}/{MAX_CHIPS})
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {intro.chips.map((c) => (
                          <span key={c} className="brutal-badge bg-durbs-cyan !py-1 !text-xs normal-case">
                            {c}
                            <button type="button" onClick={() => removeChip(c)} aria-label={`Remove ${c}`}>
                              <X className="h-3.5 w-3.5" strokeWidth={3} />
                            </button>
                          </span>
                        ))}
                      </div>
                      <form
                        className="flex gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          addChip(chipDraft);
                        }}
                      >
                        <input
                          value={chipDraft}
                          maxLength={22}
                          onChange={(e) => setChipDraft(e.target.value)}
                          placeholder="Your own chip, e.g. 🎆 Fireworks"
                          className="brutal-input"
                          disabled={intro.chips.length >= MAX_CHIPS}
                        />
                        <button type="submit" className="brutal-btn bg-white !px-3" disabled={intro.chips.length >= MAX_CHIPS}>
                          <Plus className="h-4 w-4" strokeWidth={3} /> Add
                        </button>
                      </form>
                      {intro.chips.length < MAX_CHIPS && (
                        <div className="flex flex-wrap gap-1.5">
                          {suggestions.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => addChip(s)}
                              className="border-2 border-black bg-white px-2 py-0.5 text-xs font-bold hover:bg-durbs-yellow"
                            >
                              + {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <ColorPicker value={outro.color} onChange={(color) => setOutro({ ...outro, color })} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      {["Headline line 1", "Headline line 2"].map((label, i) => (
                        <Field key={label} label={label}>
                          <input
                            value={outro.lines[i]}
                            maxLength={16}
                            onChange={(e) => setOutroLine(i, e.target.value)}
                            className="brutal-input"
                          />
                        </Field>
                      ))}
                    </div>
                    <p className="text-xs font-semibold text-neutral-600">
                      Followed by the WhatsUpDurbs card and the web address.
                    </p>
                    <Field label="Sticker" hint="e.g. List your event free ⚡, Tickets in bio 🎟️">
                      <input
                        value={outro.sticker}
                        maxLength={28}
                        onChange={(e) => setOutro({ ...outro, sticker: e.target.value })}
                        className="brutal-input"
                      />
                    </Field>
                    <Field label="Bottom line" hint="Wraps onto two lines beside the logo.">
                      <input
                        value={outro.follow}
                        maxLength={40}
                        onChange={(e) => setOutro({ ...outro, follow: e.target.value })}
                        className="brutal-input"
                      />
                    </Field>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => (clip === "intro" ? setIntro(DEFAULT_INTRO) : setOutro(DEFAULT_OUTRO))}
                  className="brutal-btn bg-white !py-1 !text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset {clip}
                </button>
              </div>
            </div>

            {/* Preview first on phones so edits are visible without scrolling past the form. */}
            <div className="order-first space-y-3 md:sticky md:top-24 md:order-none md:self-start">
              <div className="relative mx-auto aspect-[9/16] w-full max-w-[200px] border-4 md:max-w-[270px] border-black bg-black shadow-brutal-lg">
                <canvas ref={canvasRef} width={W} height={H} className="h-full w-full" aria-label={`${clip} preview`} />
                {!assets && (
                  <div className="absolute inset-0 grid place-items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  </div>
                )}
              </div>
              <div className="mx-auto flex max-w-[270px] flex-col gap-2">
                <button type="button" onClick={replay} className="brutal-btn bg-white !py-1.5 !text-xs">
                  <RotateCcw className="h-3.5 w-3.5" /> Replay
                </button>
                <button
                  type="button"
                  onClick={makeVideo}
                  disabled={!assets || progress !== null}
                  className="brutal-btn bg-durbs-pink text-white disabled:opacity-60"
                >
                  {progress !== null ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Making… {Math.round(progress * 100)}%
                    </>
                  ) : (
                    <>
                      <Clapperboard className="h-4 w-4" /> Make {clip} video
                    </>
                  )}
                </button>
                {video && (
                  <div className="space-y-2 border-3 border-black bg-durbs-yellow p-3">
                    <p className="text-xs font-bold">
                      Ready: {video.name}
                      {video.ext === "webm" && " (WebM: this browser can't make MP4; CapCut accepts it)"}
                    </p>
                    <div className="flex gap-2">
                      {canShare && (
                        <button
                          type="button"
                          onClick={() => navigator.share({ files: [video.file] }).catch(() => {})}
                          className="brutal-btn flex-1 bg-white !px-2"
                        >
                          <Share2 className="h-4 w-4" /> Share
                        </button>
                      )}
                      <button type="button" onClick={download} className="brutal-btn flex-1 bg-durbs-cyan !px-2">
                        <Download className="h-4 w-4" /> Download
                      </button>
                    </div>
                  </div>
                )}
                {error && (
                  <p role="alert" className="border-3 border-black bg-red-500 px-3 py-2 text-sm font-bold text-white">
                    {error}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

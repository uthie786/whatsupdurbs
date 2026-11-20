"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clapperboard, Download, Loader2, RotateCcw, Share2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import { ChipsEditor, ColorEditor, MediaEditor, Section, Slider, TextSlotEditor } from "@/components/reel/ReelControls";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { H, W, loadReelAssets, type ReelAssets } from "@/lib/reel/draw";
import { clipDuration, drawClip } from "@/lib/reel/clips";
import { loadMedia, releaseMedia, seekMedia, type ReelMedia } from "@/lib/reel/media";
import { renderToVideo, type RenderedVideo } from "@/lib/reel/encode";
import {
  ALL_KEYS,
  CLIP_DEFS,
  STYLE_LABELS,
  applyPreset,
  defaultConfig,
  defaultSettings,
  migrateV1,
  normalizeConfig,
  type ClipConfig,
  type ClipKey,
  type ClipKind,
  type ReelStyle,
} from "@/lib/reel/types";

const STORAGE_KEY = "whatsupdurbs-reel-maker-v2";
const V1_KEY = "whatsupdurbs-reel-maker-v1";
/** Pause on the last frame before the preview loops. */
const PREVIEW_HOLD = 0.8;

type Settings = Record<ClipKey, ClipConfig>;

function loadSaved(): { settings: Settings; style: ReelStyle } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { settings?: Partial<Settings>; style?: ReelStyle };
      const settings = Object.fromEntries(
        ALL_KEYS.map((k) => {
          const [style, clip] = k.split("-") as [ReelStyle, ClipKind];
          return [k, normalizeConfig(style, clip, saved.settings?.[k])];
        }),
      ) as Settings;
      return { settings, style: saved.style === "sunset" ? "sunset" : "brutal" };
    }
    const v1 = localStorage.getItem(V1_KEY);
    if (v1) return { settings: migrateV1(JSON.parse(v1)), style: "brutal" };
  } catch {
    // Private mode or bad data: start from the defaults.
  }
  return { settings: defaultSettings(), style: "brutal" };
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "reel";
}

const clone = (c: ClipConfig): ClipConfig => JSON.parse(JSON.stringify(c)) as ClipConfig;

export default function ReelMakerPage() {
  const [authed, setAuthed] = useState<boolean | null>(isSupabaseConfigured ? null : true);
  const [style, setStyle] = useState<ReelStyle>("brutal");
  const [clip, setClip] = useState<ClipKind>("intro");
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [media, setMedia] = useState<Partial<Record<ClipKey, ReelMedia>>>({});
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [assets, setAssets] = useState<ReelAssets | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [video, setVideo] = useState<(RenderedVideo & { url: string; name: string; file: File }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  const key: ClipKey = `${style}-${clip}`;
  const cfg = settings[key];
  const def = CLIP_DEFS[style][clip];
  const currentMedia = media[key] ?? null;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startRef = useRef(0);
  const exportingRef = useRef(false);
  const liveRef = useRef({ style, clip, cfg, media: currentMedia });
  liveRef.current = { style, clip, cfg, media: currentMedia };

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
  }, []);

  useEffect(() => {
    const saved = loadSaved();
    setSettings(saved.settings);
    setStyle(saved.style);
    setLoaded(true);
    loadReelAssets().then(setAssets, (e: unknown) => setError(errorMessage(e, "Couldn't load the fonts.")));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, style }));
    } catch {
      // Not saved; the settings still work for this visit.
    }
  }, [settings, style, loaded]);

  // A new edit makes the last video stale.
  useEffect(() => setVideo(null), [style, clip, settings, media]);
  useEffect(() => () => {
    if (video) URL.revokeObjectURL(video.url);
  }, [video]);

  // Play the current clip's video (if any) for the live preview; pause the others.
  useEffect(() => {
    for (const [k, m] of Object.entries(media)) {
      if (m?.kind !== "video") continue;
      const v = m.el as HTMLVideoElement;
      if (k === key) void v.play().catch(() => {});
      else v.pause();
    }
  }, [media, key]);

  // Release object URLs when leaving the page.
  const mediaRef = useRef(media);
  mediaRef.current = media;
  useEffect(() => () => Object.values(mediaRef.current).forEach(releaseMedia), []);

  // Live preview loop.
  useEffect(() => {
    if (!assets || !authed) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    startRef.current = performance.now();
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (exportingRef.current) return;
      const { style: s, clip: c, cfg: conf, media: m } = liveRef.current;
      const duration = clipDuration(s, c, conf);
      const t = ((performance.now() - startRef.current) / 1000) % (duration + PREVIEW_HOLD);
      drawClip(ctx, s, c, Math.min(t, duration - 1 / 30), conf, assets, m);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [assets, authed]);

  const replay = () => {
    startRef.current = performance.now();
  };

  const update = (fn: (c: ClipConfig) => ClipConfig) => setSettings((all) => ({ ...all, [key]: fn(clone(all[key])) }));

  async function chooseMedia(file: File) {
    setMediaError(null);
    setMediaBusy(true);
    try {
      const m = await loadMedia(file);
      setMedia((all) => {
        releaseMedia(all[key]);
        return { ...all, [key]: m };
      });
    } catch (e) {
      setMediaError(errorMessage(e, "Couldn't open that file."));
    } finally {
      setMediaBusy(false);
    }
  }

  function removeMedia() {
    setMedia((all) => {
      releaseMedia(all[key]);
      const next = { ...all };
      delete next[key];
      return next;
    });
  }

  async function makeVideo() {
    if (!assets) return;
    setError(null);
    setProgress(0);
    exportingRef.current = true;
    const m = currentMedia;
    const v = m?.kind === "video" ? (m.el as HTMLVideoElement) : null;
    v?.pause();
    try {
      const result = await renderToVideo(
        async (ctx, t) => {
          await seekMedia(m, t);
          drawClip(ctx, style, clip, t, cfg, assets, m);
        },
        clipDuration(style, clip, cfg),
        setProgress,
      );
      const first = def.slots.find((s) => !s.fixed);
      const name = `whatsupdurbs-${style}-${clip}-${slug(first ? cfg.slots[first.key].text : clip)}.${result.ext}`;
      const file = new File([result.blob], name, { type: result.blob.type });
      setCanShare(typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }));
      setVideo({ ...result, url: URL.createObjectURL(result.blob), name, file });
    } catch (e) {
      setError(errorMessage(e, "Couldn't make the video."));
    } finally {
      exportingRef.current = false;
      void v?.play().catch(() => {});
      setProgress(null);
    }
  }

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
            Design an animated intro or outro: pick a style, change every bit of text, colour and position, add your own
            picture or video, then download a 1080×1920 video for CapCut or Instagram.
          </p>
        </div>

        {authed === null && <Loader2 className="h-8 w-8 animate-spin" />}
        {authed === false && (
          <p className="border-3 border-black bg-durbs-yellow px-4 py-3 font-bold shadow-brutal">
            Sign in on the <Link href="/admin" className="underline">admin page</Link> first.
          </p>
        )}

        {authed && (
          <>
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Style">
                {(Object.keys(STYLE_LABELS) as ReelStyle[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={style === s}
                    onClick={() => {
                      setStyle(s);
                      replay();
                    }}
                    className={`brutal-btn !py-1.5 !text-xs ${style === s ? "bg-black text-durbs-yellow" : "bg-white"}`}
                  >
                    {s === "sunset" ? "🌴 " : "⚡ "}
                    {STYLE_LABELS[s]}
                  </button>
                ))}
              </div>
              <div className="flex gap-2" role="tablist">
                {(["intro", "outro"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={clip === c}
                    onClick={() => {
                      setClip(c);
                      replay();
                    }}
                    className={`brutal-btn !py-1.5 !text-xs ${clip === c ? "bg-durbs-pink text-white" : "bg-white"}`}
                  >
                    {c === "intro" ? "Intro" : "Outro"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-4">
                <Section title="Text">
                  <div className="grid gap-3 lg:grid-cols-2">
                    {def.slots.map((s) => (
                      <TextSlotEditor
                        key={`${key}-${s.key}`}
                        def={s}
                        slot={cfg.slots[s.key]}
                        onChange={(slot) => update((c) => ({ ...c, slots: { ...c.slots, [s.key]: slot } }))}
                      />
                    ))}
                  </div>
                  {def.chips && <ChipsEditor chips={cfg.chips} onChange={(chips) => update((c) => ({ ...c, chips }))} />}
                </Section>

                <Section title="Colours">
                  <ColorEditor
                    defs={def.colors}
                    colors={cfg.colors}
                    presets={def.presets}
                    onChange={(k, v) => update((c) => ({ ...c, colors: { ...c.colors, [k]: v } }))}
                    onPreset={(p) => update((c) => applyPreset(c, p))}
                  />
                </Section>

                <Section title="Picture or video" defaultOpen={Boolean(currentMedia)}>
                  <MediaEditor
                    media={currentMedia}
                    settings={cfg.media}
                    busy={mediaBusy}
                    error={mediaError}
                    onFile={chooseMedia}
                    onRemove={removeMedia}
                    onChange={(m) => update((c) => ({ ...c, media: m }))}
                  />
                </Section>

                <Section title="Timing" defaultOpen={false}>
                  <Slider
                    label={clip === "intro" ? "Hold before the ending wipe" : "Hold at the end"}
                    value={cfg.hold}
                    min={0}
                    max={3}
                    step={0.5}
                    unit="s"
                    onChange={(hold) => update((c) => ({ ...c, hold }))}
                  />
                  <p className="text-xs font-semibold text-neutral-600">
                    Length: {clipDuration(style, clip, cfg).toFixed(1)}s. The {clip === "intro" ? "ending" : "start"} still lines up
                    with the transitions.
                  </p>
                </Section>

                <button
                  type="button"
                  onClick={() => update(() => defaultConfig(style, clip))}
                  className="brutal-btn bg-white !py-1 !text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset this {clip}
                </button>
              </div>

              {/* Preview first on phones so edits are visible without scrolling past the form. */}
              <div className="order-first space-y-3 md:sticky md:top-24 md:order-none md:self-start">
                <div className="relative mx-auto aspect-[9/16] w-full max-w-[200px] border-4 border-black bg-black shadow-brutal-lg md:max-w-[270px]">
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
                      <p className="break-all text-xs font-bold">
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
          </>
        )}
      </main>
    </>
  );
}

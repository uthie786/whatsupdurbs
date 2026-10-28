"use client";

import { useEffect, useState } from "react";
import { Download, Instagram, Loader2, Share2, X } from "lucide-react";
import { eventPath } from "@/lib/site";
import { STORY_THEMES, type StoryTheme } from "@/lib/storyThemes";

const THEMES = Object.entries(STORY_THEMES) as [StoryTheme, (typeof STORY_THEMES)[StoryTheme]][];

/** "Story image" button: preview the 1080×1920 image, pick a colour, then share or download it. */
export default function StoryShareButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<StoryTheme>("yellow");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);

  const src = `${eventPath({ slug })}/story?theme=${theme}`;
  const filename = `whatsupdurbs-${slug}-${theme}.png`;

  // Fetch the image up front: iOS only allows navigator.share() straight from a tap,
  // so it can't wait for a download after the Share button is pressed.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setFile(null);
    setPreview(null);
    setFailed(false);
    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const f = new File([blob], filename, { type: "image/png" });
        setFile(f);
        setPreview(URL.createObjectURL(f));
        setCanShareFiles(typeof navigator.canShare === "function" && navigator.canShare({ files: [f] }));
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [open, src, filename]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const share = () => {
    if (file) navigator.share({ files: [file] }).catch(() => {});
  };

  const download = () => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="brutal-btn bg-gradient-to-r from-durbs-yellow via-durbs-pink to-durbs-purple text-black"
      >
        <Instagram className="h-4 w-4" /> Story image
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Share to your story"
        >
          <div className="flex max-h-full w-full max-w-sm flex-col gap-3 overflow-y-auto border-4 border-black bg-white p-4 shadow-brutal-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg uppercase">Share to your story</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="brutal-btn bg-white !p-1.5"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>

            <div className="flex gap-2" role="group" aria-label="Colour">
              {THEMES.map(([key, t]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={theme === key}
                  onClick={() => setTheme(key)}
                  className="brutal-chip flex flex-1 items-center justify-center gap-1.5"
                >
                  <span className="h-3.5 w-3.5 border-2 border-black" style={{ backgroundColor: t.bg }} />
                  {t.label}
                </button>
              ))}
            </div>

            <div className="relative mx-auto aspect-[9/16] w-full max-w-[240px] border-3 border-black bg-neutral-100">
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Story image preview" className="h-full w-full object-cover" />
              )}
              {!preview && !failed && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              )}
              {failed && (
                <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm font-bold">
                  Couldn&apos;t make the image. Try again in a moment.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              {canShareFiles && (
                <button
                  type="button"
                  onClick={share}
                  disabled={!file}
                  className="brutal-btn flex-1 bg-durbs-pink text-white disabled:opacity-50"
                >
                  <Share2 className="h-4 w-4" /> Share
                </button>
              )}
              <button
                type="button"
                onClick={download}
                disabled={!file}
                className="brutal-btn flex-1 bg-durbs-cyan disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> Download
              </button>
            </div>
            <p className="text-xs font-semibold text-neutral-700">
              Share it to Instagram (or save it and add it to your story), then add a link sticker to the event.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

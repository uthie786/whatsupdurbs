"use client";

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { ImagePlus } from "lucide-react";

interface PosterDropZoneProps {
  onFile?: (file: File) => void;
  /** Accept several images at once (drop, paste or pick); receives all of them. */
  onFiles?: (files: File[]) => void;
  /** Also accept images pasted anywhere on the page. */
  listenForPaste?: boolean;
  title?: string;
  hint?: ReactNode;
}

export default function PosterDropZone({
  onFile,
  onFiles,
  listenForPaste = false,
  title = "Drop a poster here, paste it, or",
  hint,
}: PosterDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const multiple = Boolean(onFiles);
  const deliver = (list: FileList | File[] | null | undefined) => {
    const images = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    if (onFiles) onFiles(images);
    else onFile?.(images[0]);
  };

  useEffect(() => {
    if (!listenForPaste) return;
    const onPaste = (e: ClipboardEvent) => {
      const images = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (images.length) {
        e.preventDefault();
        if (onFiles) onFiles(images);
        else onFile?.(images[0]);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [listenForPaste, onFile, onFiles]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    deliver(e.dataTransfer.files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`flex flex-col items-center justify-center gap-3 border-4 border-dashed border-black p-8 text-center transition-colors ${
        dragging ? "bg-durbs-cyan" : "bg-durbs-yellow/30"
      }`}
    >
      <ImagePlus className="h-10 w-10" />
      <p className="font-display uppercase">{title}</p>
      <button type="button" onClick={() => input.current?.click()} className="brutal-btn bg-durbs-pink text-white">
        {multiple ? "Choose images" : "Choose image"}
      </button>
      {hint && <p className="text-xs font-semibold text-neutral-600">{hint}</p>}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          deliver(files);
        }}
      />
    </div>
  );
}

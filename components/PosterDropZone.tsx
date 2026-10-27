"use client";

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { ImagePlus } from "lucide-react";

interface PosterDropZoneProps {
  onFile: (file: File) => void;
  /** Also accept images pasted anywhere on the page. */
  listenForPaste?: boolean;
  title?: string;
  hint?: ReactNode;
}

export default function PosterDropZone({
  onFile,
  listenForPaste = false,
  title = "Drop a poster here, paste it, or",
  hint,
}: PosterDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!listenForPaste) return;
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (file) {
        e.preventDefault();
        onFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [listenForPaste, onFile]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
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
        Choose image
      </button>
      {hint && <p className="text-xs font-semibold text-neutral-600">{hint}</p>}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </div>
  );
}

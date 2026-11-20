"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, ImagePlus, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { EVENT_CATEGORIES } from "@/types/event";
import { categoryLabel } from "@/lib/areas";
import { MAX_CHIPS, type ColorDef, type MediaSettings, type Preset, type SlotDef, type TextSlot } from "@/lib/reel/types";
import type { ReelMedia } from "@/lib/reel/media";

export function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-4 border-black bg-white shadow-brutal-lg">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 font-display text-sm uppercase"
      >
        {title}
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && <div className="space-y-4 border-t-3 border-black p-4">{children}</div>}
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex justify-between text-xs font-bold uppercase">
        {label} <span className="tabular-nums">{value}{unit}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-durbs-pink"
      />
    </label>
  );
}

function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs font-bold" title={label}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-9 w-11 cursor-pointer border-3 border-black bg-white p-0.5"
      />
    </label>
  );
}

/** One text slot: text, show/hide, colour, size and an optional position nudge. */
export function TextSlotEditor({
  def,
  slot,
  onChange,
}: {
  def: SlotDef;
  slot: TextSlot;
  onChange: (s: TextSlot) => void;
}) {
  const [moving, setMoving] = useState(false);
  const set = (patch: Partial<TextSlot>) => onChange({ ...slot, ...patch });
  return (
    <div className={`space-y-2 border-3 border-black p-3 ${slot.visible ? "bg-white" : "bg-neutral-100"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-xs uppercase">{def.label}</span>
        <button
          type="button"
          onClick={() => set({ visible: !slot.visible })}
          aria-pressed={!slot.visible}
          aria-label={slot.visible ? `Hide ${def.label}` : `Show ${def.label}`}
          className="brutal-btn bg-white !p-1.5"
        >
          {slot.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      </div>
      {slot.visible && (
        <>
          <div className="flex items-center gap-2">
            {!def.fixed && (
              <input
                value={slot.text}
                maxLength={def.maxLength}
                onChange={(e) => set({ text: e.target.value })}
                className="brutal-input !py-1.5"
                aria-label={def.label}
              />
            )}
            {(!def.fixed || def.recolor) && (
              <ColorInput value={slot.color} onChange={(color) => set({ color })} label={`${def.label} colour`} />
            )}
          </div>
          {def.hint && <p className="text-xs font-semibold text-neutral-600">{def.hint}</p>}
          <Slider label="Size" value={slot.size} min={50} max={150} unit="%" onChange={(size) => set({ size })} />
          <button
            type="button"
            onClick={() => setMoving((m) => !m)}
            className="text-xs font-black uppercase underline decoration-2 underline-offset-4"
          >
            {moving ? "Hide position" : "Adjust position"}
          </button>
          {moving && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Slider label="Left / right" value={slot.dx} min={-300} max={300} step={5} onChange={(dx) => set({ dx })} />
              <Slider label="Up / down" value={slot.dy} min={-300} max={300} step={5} onChange={(dy) => set({ dy })} />
              {(slot.dx !== 0 || slot.dy !== 0) && (
                <button type="button" onClick={() => set({ dx: 0, dy: 0 })} className="brutal-btn bg-white !py-1 !text-xs sm:col-span-2">
                  <RotateCcw className="h-3.5 w-3.5" /> Reset position
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Preset swatches plus a colour picker for every colour role. */
export function ColorEditor({
  defs,
  colors,
  presets,
  onChange,
  onPreset,
}: {
  defs: ColorDef[];
  colors: Record<string, string>;
  presets: Preset[];
  onChange: (key: string, value: string) => void;
  onPreset: (p: Preset) => void;
}) {
  const swatch = (p: Preset) => {
    const vals = Object.values(p.colors).slice(0, 3);
    return `linear-gradient(135deg, ${vals.join(", ")})`;
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Colour presets">
        {presets.map((p) => (
          <button key={p.name} type="button" onClick={() => onPreset(p)} className="brutal-chip inline-flex items-center gap-1.5 bg-white">
            <span className="h-4 w-4 border-2 border-black" style={{ background: swatch(p) }} />
            {p.name}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {defs.map((d) => (
          <label key={d.key} className="flex items-center justify-between gap-2 border-2 border-black px-2 py-1 text-xs font-bold">
            {d.label}
            <input
              type="color"
              value={colors[d.key] ?? d.value}
              onChange={(e) => onChange(d.key, e.target.value)}
              className="h-8 w-11 cursor-pointer border-2 border-black bg-white p-0.5"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

/** Add a picture or video as the background or as a framed card. */
export function MediaEditor({
  media,
  settings,
  busy,
  error,
  onFile,
  onRemove,
  onChange,
}: {
  media: ReelMedia | null;
  settings: MediaSettings;
  busy: boolean;
  error: string | null;
  onFile: (f: File) => void;
  onRemove: () => void;
  onChange: (s: MediaSettings) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<MediaSettings>) => onChange({ ...settings, ...patch });
  return (
    <div className="space-y-3">
      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      {media ? (
        <div className="flex items-center gap-3">
          {media.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.url} alt="" className="h-16 w-16 border-3 border-black object-cover" />
          ) : (
            <video src={media.url} muted playsInline className="h-16 w-16 border-3 border-black object-cover" />
          )}
          <div className="min-w-0 flex-1 text-xs font-bold">
            <p className="truncate">{media.name}</p>
            <p className="text-neutral-600">{media.kind === "video" ? "Video (no sound)" : "Picture"}</p>
          </div>
          <button type="button" onClick={() => input.current?.click()} className="brutal-btn bg-white !px-2 !py-1.5 !text-xs">
            Change
          </button>
          <button type="button" onClick={onRemove} className="brutal-btn bg-white !p-1.5" aria-label="Remove picture or video">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="brutal-btn w-full bg-durbs-cyan">
          <ImagePlus className="h-4 w-4" /> {busy ? "Loading…" : "Add a picture or video"}
        </button>
      )}
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
      {media && (
        <>
          <div className="flex gap-2" role="group" aria-label="Placement">
            {(["background", "card"] as const).map((p) => (
              <button key={p} type="button" aria-pressed={settings.placement === p} onClick={() => set({ placement: p })} className="brutal-chip flex-1">
                {p === "background" ? "Full background" : "Framed card"}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {settings.placement === "background" && (
              <Slider label="Darken" value={settings.dim} min={0} max={80} unit="%" onChange={(dim) => set({ dim })} />
            )}
            <Slider label="Zoom" value={settings.zoom} min={100} max={150} unit="%" onChange={(zoom) => set({ zoom })} />
            {settings.placement === "card" && (
              <>
                <Slider label="Card size" value={settings.cardSize} min={30} max={95} unit="%" onChange={(cardSize) => set({ cardSize })} />
                <Slider label="Card up / down" value={settings.cardY} min={-700} max={700} step={10} onChange={(cardY) => set({ cardY })} />
              </>
            )}
          </div>
        </>
      )}
      <p className="text-xs font-semibold text-neutral-600">
        Stays on your device and isn&apos;t uploaded. Videos play without sound, and you&apos;ll need to add it again next visit.
      </p>
    </div>
  );
}

export function ChipsEditor({ chips, onChange }: { chips: string[]; onChange: (c: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = (label: string) => {
    const v = label.trim();
    if (!v || chips.length >= MAX_CHIPS || chips.includes(v)) return;
    onChange([...chips, v]);
    setDraft("");
  };
  const suggestions = EVENT_CATEGORIES.map(categoryLabel).filter((c) => !chips.includes(c));
  return (
    <div className="space-y-2">
      <span className="font-display text-xs uppercase">Chips ({chips.length}/{MAX_CHIPS})</span>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <span key={c} className="brutal-badge bg-durbs-cyan !py-1 !text-xs normal-case">
            {c}
            <button type="button" onClick={() => onChange(chips.filter((x) => x !== c))} aria-label={`Remove ${c}`}>
              <X className="h-3.5 w-3.5" strokeWidth={3} />
            </button>
          </span>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(draft);
        }}
      >
        <input
          value={draft}
          maxLength={22}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Your own chip, e.g. 🎆 Fireworks"
          className="brutal-input !py-1.5"
          disabled={chips.length >= MAX_CHIPS}
        />
        <button type="submit" className="brutal-btn bg-white !px-3" disabled={chips.length >= MAX_CHIPS}>
          <Plus className="h-4 w-4" strokeWidth={3} /> Add
        </button>
      </form>
      {chips.length < MAX_CHIPS && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="border-2 border-black bg-white px-2 py-0.5 text-xs font-bold hover:bg-durbs-yellow">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { Slider };

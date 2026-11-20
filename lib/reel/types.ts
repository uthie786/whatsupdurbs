// Reel maker settings: every style/clip is described by a ClipDef (its text slots, colour roles
// and presets), so the editor UI and the drawing code share one source of truth.
import { SITE_URL } from "@/lib/site";

export type ReelStyle = "brutal" | "sunset";
export type ClipKind = "intro" | "outro";
export type ClipKey = `${ReelStyle}-${ClipKind}`;

export const STYLE_LABELS: Record<ReelStyle, string> = {
  brutal: "Neo-brutalist",
  sunset: "Sunset (game trailer)",
};

/** One piece of text (or a brand element) and how it's shown. */
export interface TextSlot {
  text: string;
  visible: boolean;
  /** Percent of the default size (50–150). */
  size: number;
  color: string;
  /** Nudge from the default position, in pixels of the 1080×1920 frame. */
  dx: number;
  dy: number;
}

export interface MediaSettings {
  placement: "background" | "card";
  /** Darken a background so text stays readable (0–80 %). */
  dim: number;
  /** 100–150 %. */
  zoom: number;
  /** Card width as a percent of the frame (30–95). */
  cardSize: number;
  /** Card centre, nudged up/down from the middle of the frame. */
  cardY: number;
}

export interface ClipConfig {
  slots: Record<string, TextSlot>;
  colors: Record<string, string>;
  /** Brutal intro only. */
  chips: string[];
  /** Extra seconds of still time before the ending (intro) or at the end (outro). */
  hold: number;
  media: MediaSettings;
}

export interface SlotDef {
  key: string;
  label: string;
  text: string;
  color: string;
  /** Brand elements (logo, site card) can be moved/hidden but not retyped. */
  fixed?: boolean;
  /** A fixed element whose colour can still be changed. */
  recolor?: boolean;
  maxLength?: number;
  hint?: string;
}

export interface ColorDef {
  key: string;
  label: string;
  value: string;
}

export interface Preset {
  name: string;
  colors: Record<string, string>;
  /** Text colours that go with the preset. */
  slotColors?: Record<string, string>;
}

export interface ClipDef {
  baseDuration: number;
  slots: SlotDef[];
  colors: ColorDef[];
  presets: Preset[];
  chips?: boolean;
}

export const MAX_CHIPS = 6;
const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

const BRAND = { yellow: "#FFE600", pink: "#FF2E93", cyan: "#00F0FF", purple: "#8A2BE2" };

const SUNSET_PRESETS: Preset[] = [
  {
    name: "Sunset",
    colors: {
      skyTop: "#2A0B4F", skyMid: "#C2338C", horizon: "#FF8A4C", sun: "#FFD36E", sea: "#3A1356",
      titleA: "#FF5FA2", titleB: "#FFB65C", glow: "#FF4FD8", badgeA: "#FF2E93", badgeB: "#FF9A3C",
      bannerA: "#FFF0A0", bannerB: "#F2A900",
    },
  },
  {
    name: "Night",
    colors: {
      skyTop: "#05031A", skyMid: "#2B1065", horizon: "#7B2CBF", sun: "#FF4FD8", sea: "#0B0726",
      titleA: "#00F0FF", titleB: "#C084FC", glow: "#00F0FF", badgeA: "#8A2BE2", badgeB: "#00F0FF",
      bannerA: "#FFF0A0", bannerB: "#F2A900",
    },
  },
  {
    name: "Sunrise",
    colors: {
      skyTop: "#FF7E8B", skyMid: "#FFB199", horizon: "#FFE29A", sun: "#FFF7D6", sea: "#E0607E",
      titleA: "#FF2E93", titleB: "#FF8A00", glow: "#FFFFFF", badgeA: "#FF2E93", badgeB: "#FFB000",
      bannerA: "#FFFFFF", bannerB: "#FFD36E",
    },
  },
  {
    name: "Ocean",
    colors: {
      skyTop: "#011F3B", skyMid: "#01497C", horizon: "#2A9D8F", sun: "#E9F5DB", sea: "#012A4A",
      titleA: "#00F0FF", titleB: "#A3E635", glow: "#00F0FF", badgeA: "#0077B6", badgeB: "#00F0FF",
      bannerA: "#E9F5DB", bannerB: "#A3E635",
    },
  },
];

const SUNSET_COLORS: ColorDef[] = [
  { key: "skyTop", label: "Sky top", value: "" },
  { key: "skyMid", label: "Sky middle", value: "" },
  { key: "horizon", label: "Horizon", value: "" },
  { key: "sun", label: "Sun", value: "" },
  { key: "sea", label: "Sea", value: "" },
  { key: "titleA", label: "Title gradient top", value: "" },
  { key: "titleB", label: "Title gradient bottom", value: "" },
  { key: "glow", label: "Glow", value: "" },
  { key: "badgeA", label: "Badge gradient start", value: "" },
  { key: "badgeB", label: "Badge gradient end", value: "" },
];

const withPreset = (defs: ColorDef[], preset: Preset): ColorDef[] =>
  defs.map((d) => ({ ...d, value: preset.colors[d.key] ?? d.value }));

export const CLIP_DEFS: Record<ReelStyle, Record<ClipKind, ClipDef>> = {
  brutal: {
    intro: {
      baseDuration: 3.0,
      chips: true,
      slots: [
        { key: "logo", label: "WhatsUpDurbs logo", text: "", color: "#000000", fixed: true },
        { key: "line1", label: "Headline line 1", text: "What's", color: "#000000", maxLength: 18 },
        { key: "line2", label: "Headline line 2", text: "on this", color: "#000000", maxLength: 18 },
        { key: "highlight", label: "Highlighted line", text: "week", color: BRAND.yellow, maxLength: 18 },
        { key: "sticker", label: "Sticker", text: "Durban 🌊", color: "#FFFFFF", maxLength: 26, hint: "e.g. Ballito ☀️, This Saturday" },
        { key: "chips", label: "Chips (as a group)", text: "", color: "#000000", fixed: true },
      ],
      colors: [
        { key: "background", label: "Background", value: BRAND.yellow },
        { key: "highlightBlock", label: "Highlight block", value: "#000000" },
        { key: "stickerFill", label: "Sticker", value: BRAND.pink },
      ],
      presets: [
        { name: "Yellow", colors: { background: BRAND.yellow, stickerFill: BRAND.pink }, slotColors: { highlight: BRAND.yellow, sticker: "#FFFFFF", line1: "#000000", line2: "#000000" } },
        { name: "Pink", colors: { background: BRAND.pink, stickerFill: BRAND.yellow }, slotColors: { highlight: BRAND.pink, sticker: "#000000", line1: "#000000", line2: "#000000" } },
        { name: "Cyan", colors: { background: BRAND.cyan, stickerFill: BRAND.pink }, slotColors: { highlight: BRAND.cyan, sticker: "#FFFFFF", line1: "#000000", line2: "#000000" } },
        { name: "Purple", colors: { background: BRAND.purple, stickerFill: BRAND.pink }, slotColors: { highlight: BRAND.yellow, sticker: "#FFFFFF", line1: "#FFFFFF", line2: "#FFFFFF" } },
      ],
    },
    outro: {
      baseDuration: 3.6,
      slots: [
        { key: "line1", label: "Headline line 1", text: "Find more", color: "#FFFFFF", maxLength: 18 },
        { key: "line2", label: "Headline line 2", text: "jols on", color: "#FFFFFF", maxLength: 18 },
        { key: "card", label: "WhatsUpDurbs card", text: "", color: "#000000", fixed: true },
        { key: "url", label: "Web address", text: SITE_HOST, color: BRAND.yellow, maxLength: 40 },
        { key: "sticker", label: "Sticker", text: "List your event free ⚡", color: "#000000", maxLength: 30, hint: "e.g. Tickets in bio 🎟️" },
        { key: "mark", label: "Logo mark", text: "", color: "#000000", fixed: true },
        { key: "follow", label: "Bottom line", text: "Follow for weekly jols 👀", color: "#FFFFFF", maxLength: 44 },
      ],
      colors: [
        { key: "background", label: "Background", value: BRAND.pink },
        { key: "stickerFill", label: "Sticker", value: BRAND.yellow },
        { key: "urlBar", label: "Web address bar", value: "#000000" },
      ],
      presets: [
        { name: "Pink", colors: { background: BRAND.pink, stickerFill: BRAND.yellow }, slotColors: { line1: "#FFFFFF", line2: "#FFFFFF", follow: "#FFFFFF" } },
        { name: "Yellow", colors: { background: BRAND.yellow, stickerFill: BRAND.cyan }, slotColors: { line1: "#FFFFFF", line2: "#FFFFFF", follow: "#FFFFFF" } },
        { name: "Cyan", colors: { background: BRAND.cyan, stickerFill: BRAND.yellow }, slotColors: { line1: "#FFFFFF", line2: "#FFFFFF", follow: "#FFFFFF" } },
        { name: "Purple", colors: { background: BRAND.purple, stickerFill: BRAND.yellow }, slotColors: { line1: "#FFFFFF", line2: "#FFFFFF", follow: "#FFFFFF" } },
      ],
    },
  },
  sunset: {
    intro: {
      baseDuration: 3.0,
      slots: [
        { key: "title1", label: "Title line 1", text: "WhatsUp", color: "#FFFFFF", maxLength: 14 },
        { key: "title2", label: "Title line 2 (big, gradient)", text: "Durbs", color: "#FFFFFF", maxLength: 10, hint: "The colour is the outline; the fill uses the title gradient." },
        { key: "badge", label: "Badge", text: "DBN", color: "#FFFFFF", maxLength: 4, hint: "Up to 4 letters" },
        { key: "tagline", label: "Tagline", text: "What's on this week", color: "#FFFFFF", maxLength: 32 },
      ],
      colors: withPreset(SUNSET_COLORS, SUNSET_PRESETS[0]),
      presets: SUNSET_PRESETS,
    },
    outro: {
      baseDuration: 3.6,
      slots: [
        { key: "banner", label: "Big line (gold)", text: "Jol passed!", color: "#000000", maxLength: 16, hint: "The colour is the outline." },
        { key: "sub", label: "Second line", text: "Respect +", color: "#FFFFFF", maxLength: 20 },
        { key: "card", label: "WhatsUpDurbs title", text: "", color: "#FFFFFF", fixed: true, recolor: true },
        { key: "url", label: "Web address", text: SITE_HOST, color: "#FFFFFF", maxLength: 40 },
        { key: "sticker", label: "Neon sign", text: "List your event free", color: "#FF4FD8", maxLength: 28 },
        { key: "follow", label: "Bottom line", text: "Follow for weekly jols 👀", color: "#FFFFFF", maxLength: 44 },
      ],
      colors: [
        ...withPreset(SUNSET_COLORS, SUNSET_PRESETS[1]),
        { key: "bannerA", label: "Big line gradient top", value: SUNSET_PRESETS[1].colors.bannerA },
        { key: "bannerB", label: "Big line gradient bottom", value: SUNSET_PRESETS[1].colors.bannerB },
      ],
      presets: SUNSET_PRESETS,
    },
  },
};

export const DEFAULT_MEDIA: MediaSettings = { placement: "background", dim: 35, zoom: 100, cardSize: 70, cardY: 0 };
export const DEFAULT_CHIPS = ["🛍️ Markets", "🎤 Gigs", "🪩 Parties", "🏃 Park runs", "🚗 Car meets"];

export function defaultConfig(style: ReelStyle, clip: ClipKind): ClipConfig {
  const def = CLIP_DEFS[style][clip];
  return {
    slots: Object.fromEntries(
      def.slots.map((s) => [s.key, { text: s.text, visible: true, size: 100, color: s.color, dx: 0, dy: 0 }]),
    ),
    colors: Object.fromEntries(def.colors.map((c) => [c.key, c.value])),
    chips: def.chips ? [...DEFAULT_CHIPS] : [],
    hold: 0,
    media: { ...DEFAULT_MEDIA },
  };
}

export const ALL_KEYS: ClipKey[] = ["brutal-intro", "brutal-outro", "sunset-intro", "sunset-outro"];

export function defaultSettings(): Record<ClipKey, ClipConfig> {
  return Object.fromEntries(
    ALL_KEYS.map((k) => {
      const [style, clip] = k.split("-") as [ReelStyle, ClipKind];
      return [k, defaultConfig(style, clip)];
    }),
  ) as Record<ClipKey, ClipConfig>;
}

/** Fill in anything missing (new slots/colours added later, or older saved data). */
export function normalizeConfig(style: ReelStyle, clip: ClipKind, saved: Partial<ClipConfig> | undefined): ClipConfig {
  const base = defaultConfig(style, clip);
  if (!saved) return base;
  const slots = { ...base.slots };
  for (const key of Object.keys(base.slots)) {
    if (saved.slots?.[key]) slots[key] = { ...base.slots[key], ...saved.slots[key] };
  }
  return {
    slots,
    colors: { ...base.colors, ...(saved.colors ?? {}) },
    chips: Array.isArray(saved.chips) ? saved.chips.slice(0, MAX_CHIPS) : base.chips,
    hold: typeof saved.hold === "number" ? Math.min(3, Math.max(0, saved.hold)) : 0,
    media: { ...base.media, ...(saved.media ?? {}) },
  };
}

const V1_COLORS: Record<string, string> = BRAND;

/** Settings saved by the first version of the reel maker ({ intro, outro } for the brutal style). */
export function migrateV1(v1: {
  intro?: { color?: string; lines?: string[]; sticker?: string; chips?: string[] };
  outro?: { color?: string; lines?: string[]; sticker?: string; follow?: string };
}): Record<ClipKey, ClipConfig> {
  const all = defaultSettings();
  const bi = all["brutal-intro"];
  const i = v1.intro;
  if (i) {
    const preset = CLIP_DEFS.brutal.intro.presets.find((p) => p.colors.background === V1_COLORS[i.color ?? ""]);
    if (preset) applyPreset(bi, preset);
    (["line1", "line2", "highlight"] as const).forEach((k, n) => {
      if (typeof i.lines?.[n] === "string") bi.slots[k].text = i.lines[n];
    });
    if (typeof i.sticker === "string") bi.slots.sticker.text = i.sticker;
    if (Array.isArray(i.chips)) bi.chips = i.chips.slice(0, MAX_CHIPS);
  }
  const bo = all["brutal-outro"];
  const o = v1.outro;
  if (o) {
    const preset = CLIP_DEFS.brutal.outro.presets.find((p) => p.colors.background === V1_COLORS[o.color ?? ""]);
    if (preset) applyPreset(bo, preset);
    (["line1", "line2"] as const).forEach((k, n) => {
      if (typeof o.lines?.[n] === "string") bo.slots[k].text = o.lines[n];
    });
    if (typeof o.sticker === "string") bo.slots.sticker.text = o.sticker;
    if (typeof o.follow === "string") bo.slots.follow.text = o.follow;
  }
  return all;
}

/** Apply a preset's colours (and matching text colours) to a config, in place. */
export function applyPreset(cfg: ClipConfig, preset: Preset): ClipConfig {
  Object.assign(cfg.colors, preset.colors);
  for (const [k, c] of Object.entries(preset.slotColors ?? {})) {
    if (cfg.slots[k]) cfg.slots[k].color = c;
  }
  return cfg;
}

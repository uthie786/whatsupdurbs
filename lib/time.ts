// Everything on the site is shown in Durban time (SAST, UTC+2, no daylight
// saving), whatever timezone the server or browser runs in.

export const SITE_TIMEZONE = "Africa/Johannesburg";
const SAST_OFFSET = "+02:00";

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: SITE_TIMEZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export interface SastParts {
  weekday: string;
  day: string;
  month: string;
  year: string;
  hour: string;
  minute: string;
}

export function sastParts(date: Date): SastParts {
  const out: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(date)) out[p.type] = p.value;
  return {
    weekday: out.weekday,
    day: out.day,
    month: out.month,
    year: out.year,
    hour: out.hour === "24" ? "00" : out.hour,
    minute: out.minute,
  };
}

/** yyyy-MM-dd of the SAST calendar day. */
export function sastDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SITE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** ISO timestamp → value for an <input type="datetime-local">, in SAST. */
export function toSastLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = sastParts(d);
  return `${sastDayKey(d)}T${p.hour}:${p.minute}`;
}

/** <input type="datetime-local"> value (read as SAST) → Date. */
export function fromSastLocalInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  const d = new Date(`${value.slice(0, 16)}:00${SAST_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Midnight SAST starts mean "no time known" for imported listings. */
export function isTimeUnknown(date: Date): boolean {
  const p = sastParts(date);
  return p.hour === "00" && p.minute === "00";
}

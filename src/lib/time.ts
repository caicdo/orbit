import type { Due } from "./types";

export const minutesNow = (d = new Date()): number => d.getHours() * 60 + d.getMinutes();

/** Epoch ms of the local midnight that `ms` falls on. */
export function dayStart(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Epoch ms of today's local midnight. */
export const today = (): number => dayStart(Date.now());

export const addDays = (ms: number, days: number): number => ms + days * 86_400_000;

export const isSameDay = (a: number, b: number): boolean => dayStart(a) === dayStart(b);

/** Which My-day bucket a due date falls into. Overdue dates count as "today"
 *  so they stay visible instead of quietly dropping off. */
export function dueBucket(due: Due): "today" | "tomorrow" | "week" | "later" | "none" {
  if (due == null) return "none";
  const diffDays = Math.round((dayStart(due) - today()) / 86_400_000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays <= 7) return "week";
  return "later";
}

const ORDINAL = (n: number): string => {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
};

/** "Tue. 4th Aug" */
export function formatDueDate(ms: number): string {
  const d = new Date(ms);
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
  const month = d.toLocaleDateString(undefined, { month: "short" });
  return `${weekday}. ${ORDINAL(d.getDate())} ${month}`;
}

/** Due-date badge for task rows: red "Due today" inside 24h, orange "Due
 *  tomorrow" 24–48h out, otherwise the exact date. Overdue counts as today. */
export function dueDisplay(due: Due, now = Date.now()): { text: string; tone: "" | "today" | "tomorrow" } {
  if (due == null) return { text: "No due date", tone: "" };
  const hoursUntilEnd = (dayStart(due) + 86_400_000 - now) / 3_600_000;
  if (hoursUntilEnd <= 24) return { text: "Due today", tone: "today" };
  if (hoursUntilEnd <= 48) return { text: "Due tomorrow", tone: "tomorrow" };
  return { text: formatDueDate(due), tone: "" };
}

/** 14:30 -> "2:30 PM". Accepts values outside 0–1439 (wraps). */
export function formatTime(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${h >= 12 ? "PM" : "AM"}`;
}

export const formatRange = (start: number, lengthMin: number): string =>
  `${formatTime(start)} – ${formatTime(start + lengthMin)}`;

export function formatHours(min: number): string {
  const h = min / 60;
  return `${h.toFixed(h % 1 ? 1 : 0)}h`;
}

export const dayLabel = (d = new Date()): string =>
  d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

export const snap = (min: number, step = 15): number => Math.round(min / step) * step;

/** The visible timeline window: 4 hours behind now, 20 ahead. */
export const WINDOW_BEHIND_MIN = 240;
export const WINDOW_TOTAL_MIN = 24 * 60;

export interface Geometry {
  windowStart: number;
  pxPerMin: number;
  height: number;
  topFor: (min: number) => number;
  minAt: (px: number) => number;
}

export function geometry(nowMin: number, zoom: number): Geometry {
  const windowStart = nowMin - WINDOW_BEHIND_MIN;
  const pxPerMin = zoom / 60;
  return {
    windowStart,
    pxPerMin,
    height: WINDOW_TOTAL_MIN * pxPerMin + 24,
    topFor: (min) => (min - windowStart) * pxPerMin,
    minAt: (px) => windowStart + px / pxPerMin,
  };
}

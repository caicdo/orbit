import { DUE, type Due } from "./types";

export const minutesNow = (d = new Date()): number => d.getHours() * 60 + d.getMinutes();

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

export const dueLabel = (d: Due): string =>
  d === DUE.today ? "Today" : d === DUE.tomorrow ? "Tomorrow" : d === DUE.none ? "—" : "This week";

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

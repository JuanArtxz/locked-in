export function nowIso(): string {
  return new Date().toISOString();
}

export function secondsBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.max(0, Math.round((end - start) / 1000));
}

export function formatHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

export function formatDurationShort(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, '0')}`;
}

/** yyyy-mm-dd in the user's LOCAL timezone (never UTC). */
export function localDayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dateKey(iso: string): string {
  return localDayKey(new Date(iso));
}

export function todayKey(): string {
  return localDayKey();
}

/** ms epoch of the local midnight that starts the given date's day. */
export function localMidnightMs(d: Date = new Date()): number {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  return m.getTime();
}

/**
 * Total overlap (in seconds) between a list of [startIso, endIso] intervals
 * and the window [fromMs, toMs].
 */
export function intervalsOverlapSec(
  intervals: [string, string][],
  fromMs: number,
  toMs: number,
): number {
  let total = 0;
  for (const [a, b] of intervals) {
    const s = Math.max(new Date(a).getTime(), fromMs);
    const e = Math.min(new Date(b).getTime(), toMs);
    if (e > s) total += (e - s) / 1000;
  }
  return Math.round(total);
}

/** Clips intervals to the window, returning only the parts inside it. */
export function clipIntervals(
  intervals: [string, string][],
  fromMs: number,
  toMs: number,
): [string, string][] {
  const out: [string, string][] = [];
  for (const [a, b] of intervals) {
    const s = Math.max(new Date(a).getTime(), fromMs);
    const e = Math.min(new Date(b).getTime(), toMs);
    if (e > s) out.push([new Date(s).toISOString(), new Date(e).toISOString()]);
  }
  return out;
}

/**
 * Boundaries of the check-in period the given date falls in, for an interval
 * of `intervalMin` minutes aligned to local midnight. Matches the Rust watcher.
 */
export function checkinPeriod(
  intervalMin: number,
  d: Date = new Date(),
): { startMs: number; endMs: number; startLabel: string; endLabel: string } {
  const midnight = localMidnightMs(d);
  const step = Math.max(1, intervalMin) * 60_000;
  const idx = Math.floor((d.getTime() - midnight) / step);
  const startMs = midnight + idx * step;
  const endMs = startMs + step;
  const label = (ms: number) => {
    const t = new Date(ms);
    return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
  };
  // period ending exactly at midnight shows as 24:00 → display 00:00
  return { startMs, endMs, startLabel: label(startMs), endLabel: label(endMs) };
}

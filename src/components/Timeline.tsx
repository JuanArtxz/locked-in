import { dateLocale, t } from '../lib/i18n';
import { formatDurationShort, formatHms } from '../lib/time';
import type { Break, Session } from '../types';

interface TimelineProps {
  sessions: Session[];
  breaks: Break[];
  isToday: boolean;
  /** fixed window (ms epoch) — when set, all rows share the same scale (Semana) */
  windowStart?: number;
  windowEnd?: number;
  compact?: boolean;
}

export function DayTimeline({
  sessions,
  breaks,
  isToday,
  windowStart,
  windowEnd,
  compact,
}: TimelineProps) {
  const points: number[] = [];
  for (const s of sessions) {
    points.push(new Date(s.started_at).getTime());
    if (s.ended_at) points.push(new Date(s.ended_at).getTime());
  }
  for (const b of breaks) {
    points.push(new Date(b.started_at).getTime());
    points.push(
      b.ended_at
        ? new Date(b.ended_at).getTime()
        : new Date(b.started_at).getTime() + b.planned_sec * 1000,
    );
  }
  if (isToday) points.push(Date.now());

  let start: number;
  let total: number;
  if (windowStart !== undefined && windowEnd !== undefined) {
    start = windowStart;
    total = windowEnd - windowStart;
  } else {
    if (points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = Math.max(max - min, 30 * 60 * 1000);
    const pad = span * 0.02;
    start = min - pad;
    total = span + pad * 2;
  }
  if (points.length === 0 && !compact) return null;

  const pct = (t: number) => `${(((t - start) / total) * 100).toFixed(2)}%`;
  const width = (a: number, b: number) => `${Math.max(0.5, ((b - a) / total) * 100).toFixed(2)}%`;
  const fmtTime = (ms: number) =>
    new Date(ms).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });

  const barHeight = compact ? 'h-5' : 'h-6';

  return (
    <div className={compact ? '' : 'mb-3'}>
      <div className={`relative w-full overflow-hidden rounded-lg bg-surface-2 ${barHeight}`}>
        {sessions.map((s) => {
          const a = new Date(s.started_at).getTime();
          const b = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
          let afk: [string, string][] = [];
          try {
            afk = s.afk_intervals ? (JSON.parse(s.afk_intervals) as [string, string][]) : [];
          } catch {
            afk = [];
          }
          let paused: [string, string][] = [];
          try {
            paused = s.pause_intervals
              ? (JSON.parse(s.pause_intervals) as [string, string | null][])
                  .filter((p): p is [string, string] => p[1] !== null)
              : [];
          } catch {
            paused = [];
          }
          return (
            <div key={`s-${s.id}`}>
              <div
                title={`${s.task} · ${formatHms(s.duration_sec ?? 0)}`}
                className="absolute top-0 h-full rounded-[3px] bg-accent/75"
                style={{ left: pct(a), width: width(a, b) }}
              />
              {afk.map(([ai, bi], i) => {
                const at = new Date(ai).getTime();
                const bt = new Date(bi).getTime();
                return (
                  <div
                    key={`afk-${s.id}-${i}`}
                    title={t('tl.afk')}
                    className="absolute top-0 h-full bg-bg/70"
                    style={{ left: pct(at), width: width(at, bt) }}
                  />
                );
              })}
              {paused.map(([pi, qi], i) => {
                const at = new Date(pi).getTime();
                const bt = new Date(qi).getTime();
                return (
                  <div
                    key={`pause-${s.id}-${i}`}
                    title={t('tl.paused')}
                    className="absolute top-0 h-full bg-bg/50"
                    style={{ left: pct(at), width: width(at, bt) }}
                  />
                );
              })}
            </div>
          );
        })}
        {breaks.map((b) => {
          const a = new Date(b.started_at).getTime();
          const end = b.ended_at
            ? new Date(b.ended_at).getTime()
            : Math.min(a + b.planned_sec * 1000, Date.now());
          return (
            <div
              key={`b-${b.id}`}
              title={`${t('tl.break', formatDurationShort(b.planned_sec))}${
                b.overrun_sec ? t('tl.overrun', formatDurationShort(b.overrun_sec)) : ''
              }`}
              className="absolute top-1/4 h-1/2 rounded-[3px] bg-warn/60"
              style={{ left: pct(a), width: width(a, end) }}
            />
          );
        })}
      </div>
      {!compact && points.length >= 2 && (
        <div className="mt-1 flex justify-between text-[9px] text-text-faint">
          <span>{fmtTime(Math.min(...points))}</span>
          <span>{isToday ? t('tl.now') : fmtTime(Math.max(...points))}</span>
        </div>
      )}
    </div>
  );
}

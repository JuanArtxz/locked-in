import { useCallback, useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import * as db from '../lib/db';
import { dateLocale, t } from '../lib/i18n';
import { checkinPeriod, todayKey } from '../lib/time';
import type { HourlyLog, Settings } from '../types';
import { ConfirmModal } from './Confirm';
import { Mascot } from './Mascot';

interface CheckinProps {
  settings: Settings | null;
  onError: (message: string) => void;
}

export function CheckinPage({ settings, onError }: CheckinProps) {
  const [logs, setLogs] = useState<HourlyLog[]>([]);
  const [streak, setStreak] = useState(0);
  const [input, setInput] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [clearModal, setClearModal] = useState(false);

  const enabled = settings?.checkin_enabled ?? true;
  const intervalMin = settings?.checkin_interval_min ?? 60;

  const reload = useCallback(() => {
    Promise.all([db.listHourlyLogs(todayKey()), db.getCheckinStreak()])
      .then(([l, s]) => {
        setLogs(l);
        setStreak(s);
      })
      .catch((err) => onError(String(err)));
  }, [onError]);

  useEffect(reload, [reload]);

  // popup saves land in the db from another window — refresh on its signal
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen('checkin:changed', reload).then((u) => {
      unlisten = u;
    });
    return () => unlisten?.();
  }, [reload]);

  // clock for "this hour" header + next check-in countdown
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const period = checkinPeriod(intervalMin, now);
  const nextInMin = Math.max(1, Math.ceil((period.endMs - now.getTime()) / 60_000));
  const nextAt = new Date(period.endMs).toLocaleTimeString(dateLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  });

  const loggedToday = logs.filter((l) => !l.skipped).length;
  const skippedToday = logs.filter((l) => l.skipped).length;

  async function saveNow() {
    const trimmed = input.trim();
    if (!trimmed) return;
    try {
      await db.addHourlyLog(todayKey(), period.startLabel, period.endLabel, trimmed, false);
      setInput('');
      reload();
    } catch (err) {
      onError(String(err));
    }
  }

  async function exportLogs() {
    try {
      const all = await db.listAllHourlyLogs();
      const lines = all.map(
        (l) =>
          `${l.day} ${l.period_start} – ${l.period_end}  ${l.skipped ? `(${t('ci.skippedrow').toLowerCase()})` : l.text ?? ''}`,
      );
      const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `locked-in-hourly-${todayKey()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      onError(String(err));
    }
  }

  const createdTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex h-full flex-col">
      {/* page-level scroller like Habits — same scrollbar gutter, so the
          centered column lands at the SAME x as the Habits tab */}
      <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="cascade mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6 xl:max-w-4xl">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-text">
              {t('ci.thishour')} <span className="text-accent">{period.startLabel}</span>
            </h1>
            <p className="mt-1.5 text-[13px] text-text-faint">
              {enabled ? (
                <>
                  {t('ci.next')} <span className="text-accent">{nextAt}</span>
                  <span className="text-text-faint"> · {nextInMin}min</span>
                  {settings?.checkin_only_session && (
                    <span className="text-text-faint"> · {t('ci.onlysession')}</span>
                  )}
                </>
              ) : (
                t('ci.off')
              )}
            </p>
          </div>
          <Mascot mood={loggedToday > 0 ? 'happy' : 'relax'} size={60} />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3.5">
          <div
            className={`rounded-2xl p-5 ${
              loggedToday > 0 ? 'bg-accent text-bg' : 'border border-border bg-surface'
            }`}
          >
            <div className="font-mono text-3xl font-bold tabular-nums">{loggedToday}</div>
            <div
              className={`mt-1 text-[11px] font-semibold tracking-[0.1em] ${
                loggedToday > 0 ? 'text-bg/70' : 'text-text-faint'
              }`}
            >
              {t('ci.logged')}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="font-mono text-3xl font-bold tabular-nums text-text">{streak}</div>
            <div className="mt-1 text-[11px] font-semibold tracking-[0.1em] text-text-faint">
              {t('ci.streak')}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="font-mono text-3xl font-bold tabular-nums text-text">
              {skippedToday}
            </div>
            <div className="mt-1 text-[11px] font-semibold tracking-[0.1em] text-text-faint">
              {t('ci.skipped')}
            </div>
          </div>
        </div>

        <div className="mb-2.5 mt-7 flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-text-faint">
            {t('ci.todaylog')}
          </h2>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={exportLogs}
              className="no-press rounded-full px-3 py-1.5 text-[11px] font-semibold text-text-faint transition-colors hover:bg-surface-hover hover:text-text"
            >
              {t('ci.export')}
            </button>
            <button
              type="button"
              onClick={() => setClearModal(true)}
              className="no-press rounded-full px-3 py-1.5 text-[11px] font-semibold text-text-faint transition-colors hover:bg-danger/10 hover:text-danger"
            >
              {t('ci.clear')}
            </button>
          </div>
        </div>
        <div className="space-y-2 pb-3">
          {logs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border py-8 text-center text-xs text-text-faint">
              {t('ci.empty')}
            </div>
          )}
          {logs.map((l) => {
            // a just-saved log rises in and flashes accent once
            const fresh = Date.now() - new Date(l.created_at).getTime() < 4000;
            return (
              <div
                key={l.id}
                className={`flex items-center gap-3.5 rounded-2xl border border-border bg-surface px-4 py-3.5 ${
                  fresh ? 'animate-fade-up flash-msg' : ''
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-xs font-semibold tabular-nums text-text-dim">
                  {l.period_start.slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs tabular-nums text-text-faint">
                    {l.period_start} – {l.period_end}
                  </div>
                  {l.skipped ? (
                    <div className="text-sm italic text-text-faint">{t('ci.skippedrow')}</div>
                  ) : (
                    <div className="break-words text-sm text-text">{l.text}</div>
                  )}
                </div>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-faint">
                  {createdTime(l.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      </div>

      <div className="border-t border-border bg-bg/80">
        <div className="mx-auto w-full max-w-3xl px-4 py-3.5 sm:px-6 xl:max-w-4xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveNow();
            }}
            className="flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('ci.input.placeholder')}
              className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-accent"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-bg hover:brightness-110 disabled:opacity-30"
              aria-label={t('misc.save')}
            >
              →
            </button>
          </form>
          <div className="mt-2 text-xs text-text-faint">
            {streak >= 2 ? (
              <span className="text-accent">{t('ci.streakon', String(streak))}</span>
            ) : (
              t('ci.nostreak')
            )}
          </div>
        </div>
      </div>

      {clearModal && (
        <ConfirmModal
          title={t('ci.clear')}
          body={t('ci.clear.confirm')}
          confirmLabel={t('ci.clear')}
          onConfirm={() =>
            db.clearHourlyLogs().then(reload).catch((err) => onError(String(err)))
          }
          onClose={() => setClearModal(false)}
        />
      )}
    </div>
  );
}

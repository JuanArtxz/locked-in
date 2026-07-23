import { useEffect, useRef, useState } from 'react';
import type { Settings } from '../types';
import { t } from '../lib/i18n';
import * as social from '../lib/social';
import { ACCENT_PRESETS } from './Settings';
import { NAV_ICONS } from './Titlebar';
import logoUrl from '../assets/logo.png';

interface OnboardingProps {
  settings: Settings;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  signedIn: boolean;
  onCreateAccount: () => void;
  onDone: () => void;
}

/** Curated auto-tracker suggestions — lowercase, matched against window titles. */
const APP_SUGGESTIONS = [
  'visual studio code',
  'roblox studio',
  'photoshop',
  'figma',
  'blender',
  'unity',
  'godot',
  'aseprite',
  'premiere pro',
  'after effects',
  'davinci resolve',
  'fl studio',
  'ableton live',
  'obs',
  'word',
  'excel',
  'powerpoint',
  'notion',
  'obsidian',
  'intellij idea',
  'android studio',
];

const GOAL_OPTIONS = [1, 2, 3, 4, 6, 8];

const TOUR_TABS = [
  'home',
  'routine',
  'tasks',
  'analytics',
  'goals',
  'friends',
  'ranking',
] as const;
type TourTab = (typeof TOUR_TABS)[number];
const TOUR_LABEL_KEY: Record<TourTab, string> = {
  home: 'tab.home',
  routine: 'tab.routine',
  tasks: 'tab.tasks',
  analytics: 'tab.analytics',
  goals: 'tab.goals',
  friends: 'tab.friends',
  ranking: 'tab.ranking',
};

const STEPS = ['welcome', 'goal', 'autotrack', 'accent', 'extras', 'tour', 'social', 'loading'] as const;
type Step = (typeof STEPS)[number];

const RING_R = 50;
const RING_C = 2 * Math.PI * RING_R;

export function Onboarding({ settings, update, signedIn, onCreateAccount, onDone }: OnboardingProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const step: Step = STEPS[stepIdx];

  // local selections — committed to settings as the user picks them
  const [goal, setGoal] = useState(settings.daily_goal_hours || 3);
  const [autotrackOn, setAutotrackOn] = useState(settings.autotrack_enabled);
  const [apps, setApps] = useState<Set<string>>(() => {
    const cur = settings.autotrack_apps
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return new Set(cur.filter((a) => APP_SUGGESTIONS.includes(a)));
  });
  const [customApp, setCustomApp] = useState('');
  const [customApps, setCustomApps] = useState<string[]>(() =>
    settings.autotrack_apps
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((a) => a && !APP_SUGGESTIONS.includes(a)),
  );
  const [accent, setAccent] = useState(settings.accent_color);
  const [sound, setSound] = useState(settings.sound_enabled);
  const [pomo, setPomo] = useState(settings.pomodoro_enabled);
  const [overlay, setOverlay] = useState(settings.overlay_enabled);
  const [checkin, setCheckin] = useState(settings.checkin_enabled);
  const [telemetry, setTelemetry] = useState(settings.telemetry_enabled);
  const [tourSel, setTourSel] = useState<TourTab>('home');
  const [friendName, setFriendName] = useState('');
  const [friendMsg, setFriendMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [friendBusy, setFriendBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string[]>([]);
  const [loadPct, setLoadPct] = useState(0);
  const finishedRef = useRef(false);

  const commitApps = (on: boolean, sel: Set<string>, customs: string[]) => {
    update('autotrack_enabled', on);
    const list = [...sel, ...customs].join(', ');
    if (list) update('autotrack_apps', list);
  };

  const next = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIdx((i) => Math.max(i - 1, 0));

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    localStorage.setItem('onboarded-v1', '1');
    onDone();
  };

  // final screen: circular progress fills over ~2.6s, then the app opens
  useEffect(() => {
    if (step !== 'loading') return;
    const t0 = performance.now();
    const dur = 2600;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      setLoadPct(1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(tick);
      else window.setTimeout(finish, 300);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function addFriend() {
    const name = friendName.trim();
    if (!name || friendBusy) return;
    setFriendBusy(true);
    setFriendMsg(null);
    try {
      const r = await social.sendFriendRequest(name);
      if (r === 'sent') {
        setSentTo((prev) => [...prev, name.replace(/^@/, '')]);
        setFriendName('');
      } else if (r === 'notfound') setFriendMsg({ text: t('fr.err.notfound'), ok: false });
      else if (r === 'self') setFriendMsg({ text: t('fr.err.self'), ok: false });
      else if (r === 'duplicate') setFriendMsg({ text: t('fr.err.duplicate'), ok: false });
      else setFriendMsg({ text: t('fr.err.generic'), ok: false });
    } finally {
      setFriendBusy(false);
    }
  }

  const chip = (active: boolean) =>
    `no-press rounded-full px-4 py-2.5 text-sm font-bold transition-colors duration-300 ${
      active ? 'bg-accent text-bg' : 'bg-surface text-text-dim hover:text-text'
    }`;

  const toggleRow = (label: string, hint: string, value: boolean, set: (v: boolean) => void) => (
    <button
      type="button"
      onClick={() => set(!value)}
      className="no-press flex w-full items-center justify-between gap-4 rounded-2xl border bg-surface px-5 py-4 text-left"
    >
      <div className="min-w-0">
        <div className="text-[15px] font-extrabold text-text">{label}</div>
        <div className="mt-0.5 text-[12px] font-medium text-text-dim">{hint}</div>
      </div>
      <span
        role="switch"
        aria-checked={value}
        className={`h-[26px] w-12 shrink-0 rounded-full p-[3px] transition-colors duration-300 ${
          value ? 'bg-accent' : 'bg-border-strong'
        }`}
      >
        <span
          className={`block h-[20px] w-[20px] rounded-full bg-bg transition-transform duration-300 ease-out ${
            value ? 'translate-x-[22px]' : ''
          }`}
        />
      </span>
    </button>
  );

  const loadMsg =
    loadPct < 0.4 ? t('ob.load.1') : loadPct < 0.8 ? t('ob.load.2') : t('ob.load.3');

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-bg">
      {/* one huge quiet glow, same language as the Focus screen */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle 63vh at 50% 42%, color-mix(in srgb, var(--color-accent) 6.5%, transparent), transparent 72%)',
        }}
        aria-hidden
      />
      <div className="relative flex h-full w-full max-w-2xl flex-col px-10 py-8">
        {/* progress + skip (hidden on the final loading screen) */}
        <div className={`flex items-center justify-between ${step === 'loading' ? 'invisible' : ''}`}>
          <div className="flex gap-1.5">
            {STEPS.slice(0, -1).map((s, i) => (
              <span
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === stepIdx ? 'w-8 bg-accent' : i < stepIdx ? 'w-4 bg-accent/40' : 'w-4 bg-border-strong'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={finish}
            className="text-[13px] font-bold text-text-faint transition-colors hover:text-text"
          >
            {t('ob.skip')}
          </button>
        </div>

        {/* step body — materialize cascade on every step change */}
        <div
          key={step}
          className="cascade flex min-h-0 flex-1 flex-col items-center justify-center gap-6 text-center"
        >
          {step === 'welcome' && (
            <>
              <img
                src={logoUrl}
                alt="Locked In"
                draggable={false}
                className="pointer-events-none h-14 w-auto select-none"
              />
              <p className="mx-auto max-w-md text-base font-medium leading-relaxed text-text-dim">
                {t('ob.welcome.sub')}
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {(['tab.home', 'tab.tasks', 'tab.friends', 'tab.ranking'] as const).map((k) => (
                  <span
                    key={k}
                    className="rounded-full bg-surface px-3.5 py-1.5 text-xs font-bold text-text-dim"
                  >
                    {t(k)}
                  </span>
                ))}
              </div>
            </>
          )}

          {step === 'goal' && (
            <>
              <div>
                <h2 className="text-2xl font-extrabold text-text">{t('ob.goal.title')}</h2>
                <p className="mt-2 text-sm font-medium text-text-dim">{t('ob.goal.sub')}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {GOAL_OPTIONS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className={`no-press rounded-2xl px-6 py-3.5 text-base font-extrabold tabular-nums transition-colors duration-300 ${
                      goal === h ? 'bg-accent text-bg' : 'bg-surface text-text-dim hover:text-text'
                    }`}
                    onClick={() => {
                      setGoal(h);
                      update('daily_goal_hours', h);
                    }}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'autotrack' && (
            <>
              <div>
                <h2 className="text-2xl font-extrabold text-text">{t('ob.auto.title')}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm font-medium text-text-dim">
                  {t('ob.auto.sub')}
                </p>
              </div>
              <div className="w-full max-w-sm">
                {toggleRow(t('ob.auto.toggle'), t('ob.auto.toggle.hint'), autotrackOn, (v) => {
                  setAutotrackOn(v);
                  commitApps(v, apps, customApps);
                })}
              </div>
              {/* app list slides open under the toggle — no scroll, no pop-in */}
              <div
                className={`grid w-full transition-all duration-500 ease-out ${
                  autotrackOn ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="flex flex-wrap justify-center gap-1.5 px-1 pb-1">
                    {APP_SUGGESTIONS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        tabIndex={autotrackOn ? 0 : -1}
                        className={chip(apps.has(a))}
                        onClick={() => {
                          const nextSet = new Set(apps);
                          if (nextSet.has(a)) nextSet.delete(a);
                          else nextSet.add(a);
                          setApps(nextSet);
                          commitApps(autotrackOn, nextSet, customApps);
                        }}
                      >
                        {a}
                      </button>
                    ))}
                    {customApps.map((a) => (
                      <button
                        key={a}
                        type="button"
                        className={chip(true)}
                        onClick={() => {
                          const nextCustom = customApps.filter((x) => x !== a);
                          setCustomApps(nextCustom);
                          commitApps(autotrackOn, apps, nextCustom);
                        }}
                      >
                        {a} ✕
                      </button>
                    ))}
                  </div>
                  <form
                    className="mx-auto mt-3 flex w-full max-w-xs items-center gap-1 rounded-full bg-surface py-1.5 pl-4 pr-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const name = customApp.trim().toLowerCase();
                      if (!name || apps.has(name) || customApps.includes(name)) return;
                      const nextCustom = [...customApps, name];
                      setCustomApps(nextCustom);
                      setCustomApp('');
                      commitApps(autotrackOn, apps, nextCustom);
                    }}
                  >
                    <input
                      value={customApp}
                      onChange={(e) => setCustomApp(e.target.value)}
                      tabIndex={autotrackOn ? 0 : -1}
                      placeholder={t('ob.auto.custom')}
                      className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-text outline-none placeholder:text-text-faint"
                    />
                    <button
                      type="submit"
                      tabIndex={autotrackOn ? 0 : -1}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-base font-extrabold text-bg"
                    >
                      +
                    </button>
                  </form>
                </div>
              </div>
            </>
          )}

          {step === 'accent' && (
            <>
              <div>
                <h2 className="text-2xl font-extrabold text-text">{t('ob.accent.title')}</h2>
                <p className="mt-2 text-sm font-medium text-text-dim">{t('ob.accent.sub')}</p>
              </div>
              <div className="grid grid-cols-5 gap-4">
                {ACCENT_PRESETS.map((p) => (
                  <button
                    key={p.color}
                    type="button"
                    title={t(p.nameKey)}
                    onClick={() => {
                      setAccent(p.color);
                      update('accent_color', p.color);
                    }}
                    className="no-press flex h-11 w-11 items-center justify-center rounded-full transition-shadow duration-300"
                    style={{
                      backgroundColor: p.color,
                      boxShadow:
                        accent === p.color
                          ? `0 0 0 3px var(--color-bg), 0 0 0 5px ${p.color}`
                          : 'none',
                    }}
                  >
                    {accent === p.color && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#101113" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'extras' && (
            <>
              <div>
                <h2 className="text-2xl font-extrabold text-text">{t('ob.extras.title')}</h2>
                <p className="mt-2 text-sm font-medium text-text-dim">{t('ob.extras.sub')}</p>
              </div>
              <div className="w-full max-w-sm space-y-2">
                {toggleRow(t('set.sound'), t('ob.extras.sound'), sound, (v) => {
                  setSound(v);
                  update('sound_enabled', v);
                })}
                {toggleRow(t('set.pomodoro'), t('ob.extras.pomo'), pomo, (v) => {
                  setPomo(v);
                  update('pomodoro_enabled', v);
                })}
                {toggleRow(t('set.overlay'), t('ob.extras.overlay'), overlay, (v) => {
                  setOverlay(v);
                  update('overlay_enabled', v);
                })}
                {toggleRow(t('set.checkin'), t('ob.extras.checkin'), checkin, (v) => {
                  setCheckin(v);
                  update('checkin_enabled', v);
                })}
                {toggleRow(t('set.telemetry'), t('ob.extras.telemetry'), telemetry, (v) => {
                  setTelemetry(v);
                  update('telemetry_enabled', v);
                })}
              </div>
            </>
          )}

          {step === 'tour' && (
            <>
              <div>
                <h2 className="text-2xl font-extrabold text-text">{t('ob.tour.title')}</h2>
                <p className="mt-2 text-sm font-medium text-text-dim">{t('ob.tour.sub')}</p>
              </div>
              {/* the real nav pill, miniature — tap around, label slides open */}
              <div className="flex items-center gap-1 rounded-full border bg-surface p-1.5">
                {TOUR_TABS.map((id) => {
                  const active = tourSel === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTourSel(id)}
                      className={`no-press flex h-11 shrink-0 items-center justify-center rounded-full px-3 text-[13px] font-bold transition-colors duration-300 ${
                        active ? 'bg-accent text-bg' : 'text-text-dim hover:text-text'
                      }`}
                    >
                      {NAV_ICONS[id]}
                      <span
                        className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin-left] duration-300 ease-out ${
                          active ? 'ml-2 max-w-[8rem] opacity-100' : 'ml-0 max-w-0 opacity-0'
                        }`}
                      >
                        {t(TOUR_LABEL_KEY[id])}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p
                key={tourSel}
                className="animate-fade-in mx-auto max-w-sm text-[15px] font-medium leading-relaxed text-text-dim"
              >
                {t(`ob.tour.${tourSel}`)}
              </p>
            </>
          )}

          {step === 'social' && (
            <>
              <div>
                <h2 className="text-2xl font-extrabold text-text">{t('ob.social.title')}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm font-medium text-text-dim">
                  {t('ob.social.sub')}
                </p>
              </div>
              {signedIn ? (
                <div className="w-full max-w-xs">
                  <form
                    className="flex items-center gap-1 rounded-full bg-surface py-1.5 pl-4 pr-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      addFriend();
                    }}
                  >
                    <input
                      value={friendName}
                      onChange={(e) => setFriendName(e.target.value)}
                      placeholder={t('fr.add.placeholder')}
                      className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-text outline-none placeholder:text-text-faint"
                    />
                    <button
                      type="submit"
                      disabled={friendBusy}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-base font-extrabold text-bg transition-opacity disabled:opacity-50"
                    >
                      +
                    </button>
                  </form>
                  {sentTo.length > 0 && (
                    <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                      {sentTo.map((n) => (
                        <span
                          key={n}
                          className="animate-fade-up flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent"
                        >
                          @{n}
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="m5 12.5 4.5 4.5L19 7.5" />
                          </svg>
                        </span>
                      ))}
                    </div>
                  )}
                  {friendMsg && !friendMsg.ok && (
                    <p className="animate-fade-in mt-2 text-[12px] font-bold text-danger">
                      {friendMsg.text}
                    </p>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onCreateAccount}
                  className="rounded-2xl bg-accent px-8 py-4 text-base font-extrabold text-bg"
                >
                  {t('ob.social.create')}
                </button>
              )}
            </>
          )}

          {step === 'loading' && (
            <>
              <div className="relative">
                <svg width="128" height="128" viewBox="0 0 128 128" aria-hidden>
                  <circle
                    cx="64"
                    cy="64"
                    r={RING_R}
                    fill="none"
                    stroke="rgba(255,255,255,0.07)"
                    strokeWidth="8"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r={RING_R}
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={RING_C}
                    strokeDashoffset={RING_C * (1 - loadPct)}
                    transform="rotate(-90 64 64)"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-extrabold tabular-nums text-text">
                  {Math.round(loadPct * 100)}%
                </span>
              </div>
              <p key={loadMsg} className="animate-fade-in text-[15px] font-semibold text-text-dim">
                {loadMsg}
              </p>
            </>
          )}
        </div>

        {/* nav */}
        <div className={`flex items-center justify-between ${step === 'loading' ? 'invisible' : ''}`}>
          <button
            type="button"
            onClick={back}
            className={`rounded-xl px-5 py-3 text-sm font-bold text-text-dim transition-colors hover:text-text ${
              stepIdx === 0 ? 'invisible' : ''
            }`}
          >
            {t('ob.back')}
          </button>
          <button
            type="button"
            onClick={next}
            className="rounded-2xl bg-accent px-10 py-3.5 text-base font-extrabold text-bg"
          >
            {step === 'social' ? t('ob.finish') : step === 'welcome' ? t('ob.start') : t('ob.next')}
          </button>
        </div>
      </div>
    </div>
  );
}

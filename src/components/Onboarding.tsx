import { useState } from 'react';
import type { Settings } from '../types';
import { Mascot } from './Mascot';
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
const TOUR_LABEL_KEY: Record<(typeof TOUR_TABS)[number], string> = {
  home: 'tab.home',
  routine: 'tab.routine',
  tasks: 'tab.tasks',
  analytics: 'tab.analytics',
  goals: 'tab.goals',
  friends: 'tab.friends',
  ranking: 'tab.ranking',
};

const STEPS = ['welcome', 'goal', 'autotrack', 'accent', 'extras', 'tour', 'social', 'done'] as const;
type Step = (typeof STEPS)[number];

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
  const [friendName, setFriendName] = useState('');
  const [friendMsg, setFriendMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [friendBusy, setFriendBusy] = useState(false);

  const commitApps = (on: boolean, sel: Set<string>, customs: string[]) => {
    update('autotrack_enabled', on);
    const list = [...sel, ...customs].join(', ');
    if (list) update('autotrack_apps', list);
  };

  const next = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIdx((i) => Math.max(i - 1, 0));

  const finish = () => {
    localStorage.setItem('onboarded-v1', '1');
    onDone();
  };

  async function addFriend() {
    const name = friendName.trim();
    if (!name || friendBusy) return;
    setFriendBusy(true);
    setFriendMsg(null);
    try {
      const r = await social.sendFriendRequest(name);
      if (r === 'sent') {
        setFriendMsg({ text: t('fr.add.sent', name.replace(/^@/, '')), ok: true });
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
    `no-press rounded-full px-4 py-2.5 text-sm font-bold transition-colors ${
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
        className={`h-[26px] w-12 shrink-0 rounded-full p-[3px] transition-colors ${
          value ? 'bg-accent' : 'bg-border-strong'
        }`}
      >
        <span
          className={`block h-[20px] w-[20px] rounded-full bg-bg transition-transform duration-200 ${
            value ? 'translate-x-[22px]' : ''
          }`}
        />
      </span>
    </button>
  );

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
        {/* progress + skip */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === stepIdx ? 'w-8 bg-accent' : i < stepIdx ? 'w-4 bg-accent/40' : 'w-4 bg-border-strong'
                }`}
              />
            ))}
          </div>
          {step !== 'done' && (
            <button
              type="button"
              onClick={finish}
              className="text-[13px] font-bold text-text-faint transition-colors hover:text-text"
            >
              {t('ob.skip')}
            </button>
          )}
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
                <p className="mt-2 text-[13px] font-medium text-text-dim">{t('ob.goal.sub')}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {GOAL_OPTIONS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className={`no-press rounded-2xl px-6 py-3.5 text-base font-extrabold tabular-nums transition-colors ${
                      goal === h ? 'bg-accent text-bg' : 'border bg-surface text-text-dim hover:text-text'
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
                <p className="mx-auto mt-2 max-w-md text-[13px] font-medium text-text-dim">
                  {t('ob.auto.sub')}
                </p>
              </div>
              <div className="w-full max-w-sm">
                {toggleRow(t('ob.auto.toggle'), t('ob.auto.toggle.hint'), autotrackOn, (v) => {
                  setAutotrackOn(v);
                  commitApps(v, apps, customApps);
                })}
              </div>
              {autotrackOn && (
                <>
                  <div className="scrollbar-none flex max-h-40 flex-wrap justify-center gap-1.5 overflow-y-auto">
                    {APP_SUGGESTIONS.map((a) => (
                      <button
                        key={a}
                        type="button"
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
                    className="flex w-full max-w-xs items-center gap-1 rounded-full bg-surface py-1.5 pl-4 pr-1.5"
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
                      placeholder={t('ob.auto.custom')}
                      className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-text outline-none placeholder:text-text-faint"
                    />
                    <button
                      type="submit"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-base font-extrabold text-bg"
                    >
                      +
                    </button>
                  </form>
                </>
              )}
            </>
          )}

          {step === 'accent' && (
            <>
              <div>
                <h2 className="text-2xl font-extrabold text-text">{t('ob.accent.title')}</h2>
                <p className="mt-2 text-[13px] font-medium text-text-dim">{t('ob.accent.sub')}</p>
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
                    className="no-press flex h-11 w-11 items-center justify-center rounded-full transition-shadow"
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
                <p className="mt-2 text-[13px] font-medium text-text-dim">{t('ob.extras.sub')}</p>
              </div>
              <div className="scrollbar-none w-full max-w-sm space-y-2 overflow-y-auto">
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
                <p className="mt-2 text-[13px] font-medium text-text-dim">{t('ob.tour.sub')}</p>
              </div>
              <div className="grid w-full max-w-lg grid-cols-2 gap-2">
                {TOUR_TABS.map((id) => (
                  <div
                    key={id}
                    className={`flex items-center gap-3 rounded-2xl border bg-surface px-4 py-3 text-left ${
                      id === 'ranking' ? 'col-span-2 justify-self-center px-6' : ''
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                      {NAV_ICONS[id]}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-extrabold text-text">
                        {t(TOUR_LABEL_KEY[id])}
                      </div>
                      <div className="text-[11.5px] font-medium leading-snug text-text-dim">
                        {t(`ob.tour.${id}`)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 'social' && (
            <>
              <div>
                <h2 className="text-2xl font-extrabold text-text">{t('ob.social.title')}</h2>
                <p className="mx-auto mt-2 max-w-md text-[13px] font-medium text-text-dim">
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
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-base font-extrabold text-bg disabled:opacity-50"
                    >
                      +
                    </button>
                  </form>
                  {friendMsg && (
                    <p
                      className={`mt-2 text-[12px] font-bold ${
                        friendMsg.ok ? 'text-accent' : 'text-danger'
                      }`}
                    >
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

          {step === 'done' && (
            <>
              <Mascot mood="hyped" size={120} />
              <div>
                <h2 className="text-3xl font-extrabold text-text">{t('ob.done.title')}</h2>
                <p className="mx-auto mt-3 max-w-md text-base font-medium leading-relaxed text-text-dim">
                  {t('ob.done.sub', String(goal))}
                </p>
              </div>
            </>
          )}
        </div>

        {/* nav */}
        <div className="flex items-center justify-between">
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
            onClick={step === 'done' ? finish : next}
            className="rounded-2xl bg-accent px-10 py-3.5 text-base font-extrabold text-bg"
          >
            {step === 'done' ? t('ob.finish') : step === 'welcome' ? t('ob.start') : t('ob.next')}
          </button>
        </div>
      </div>
    </div>
  );
}

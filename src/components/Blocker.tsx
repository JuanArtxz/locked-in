import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { formatDurationShort } from '../lib/time';
import type { BlockerState } from '../types';
import { Mascot } from './Mascot';

const INITIAL: BlockerState = {
  usedSec: 0,
  allowanceSec: 30 * 60,
  focusToNextSec: 60 * 60,
  bonusMin: 30,
  snoozesLeft: 3,
};

export function Blocker() {
  const [s, setS] = useState<BlockerState>(INITIAL);
  const [closing, setClosing] = useState(false);

  async function closeInsta() {
    setClosing(true);
    // rust finds the instagram window, focuses it, sends Ctrl+W;
    // the watcher hides this screen a moment later
    await invoke<boolean>('close_insta_tab').catch(() => false);
    window.setTimeout(() => setClosing(false), 3000);
  }

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<BlockerState>('blocker:state', (e) => setS(e.payload)).then((u) => {
      unlisten = u;
    });
    return () => unlisten?.();
  }, []);

  async function snooze() {
    // rust decrements the counter and hides this window
    const left = await invoke<number>('insta_snooze').catch(() => 0);
    setS((prev) => ({ ...prev, snoozesLeft: left }));
  }

  async function goFocus() {
    const main = await WebviewWindow.getByLabel('main');
    await main?.show();
    await main?.setFocus();
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-7 bg-bg px-8 text-center">
      <Mascot mood="sad" size={150} />

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-text">O doomscroll de hoje acabou</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-dim">
          Você usou{' '}
          <span className="font-mono text-text">{formatDurationShort(s.usedSec)}</span> dos{' '}
          <span className="font-mono text-text">{formatDurationShort(s.allowanceSec)}</span>{' '}
          liberados de rede social. Sem drama — é você quem definiu essa regra 😌
        </p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5">
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-faint">
          Como ganhar mais
        </div>
        <div className="mt-2 text-sm text-text">
          Foca mais{' '}
          <span className="font-mono text-lg font-semibold text-accent">
            {formatDurationShort(s.focusToNextSec)}
          </span>{' '}
          → desbloqueia <span className="font-semibold text-accent">+{s.bonusMin}min</span> de
          scroll
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={closeInsta}
            disabled={closing}
            className="rounded-xl border border-border bg-surface px-6 py-3 text-sm font-semibold text-text hover:border-border-strong hover:bg-surface-hover disabled:opacity-50"
          >
            {closing ? 'fechando…' : 'fecha essa aba pra mim ✂️'}
          </button>
          <button
            type="button"
            onClick={goFocus}
            className="rounded-xl bg-accent px-6 py-3 text-sm font-bold text-bg hover:brightness-110"
          >
            Bora focar 🔒
          </button>
        </div>
        {s.snoozesLeft > 0 ? (
          <button
            type="button"
            onClick={snooze}
            className="text-xs text-text-faint underline decoration-border underline-offset-4 transition-colors hover:text-text-dim"
          >
            me dá 20 segundos ({s.snoozesLeft} {s.snoozesLeft === 1 ? 'restante' : 'restantes'}{' '}
            hoje)
          </button>
        ) : (
          <span className="text-xs text-text-faint">
            as dispensas de hoje acabaram — fecha a rede social ou vai focar 😤
          </span>
        )}
      </div>

      <p className="text-[11px] text-text-faint">
        essa tela some sozinha quando você sair da rede social (Alt+Tab também funciona)
      </p>
    </div>
  );
}

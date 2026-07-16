import { useEffect, useRef, useState } from 'react';
import * as cloud from '../lib/cloud';
import * as db from '../lib/db';
import { t } from '../lib/i18n';
import * as social from '../lib/social';
import { formatDurationShort } from '../lib/time';
import type { SocialHook } from '../hooks/useSocial';
import { Mascot } from './Mascot';

interface ProfileProps {
  social: SocialHook;
  userName: string | null;
  onError: (m: string) => void;
  onClose: () => void;
  onOpenFriends: () => void;
}

/** Reads a picked image file and returns a small square jpeg data-url. */
function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const SIZE = 128;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas'));
      // center-crop to a square, then scale down
      const side = Math.min(img.width, img.height);
      ctx.drawImage(
        img,
        (img.width - side) / 2,
        (img.height - side) / 2,
        side,
        side,
        0,
        0,
        SIZE,
        SIZE,
      );
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('bad image'));
    };
    img.src = url;
  });
}

export function ProfileModal({ social: soc, userName, onError, onClose, onOpenFriends }: ProfileProps) {
  const me = soc.state?.me ?? null;
  const [email, setEmail] = useState('');
  const [stats, setStats] = useState<{ totalSec: number; sessionCount: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    cloud.currentUser().then((u) => setEmail(u?.email ?? ''));
    db.getLifetimeStats().then(setStats).catch(() => {});
  }, []);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const b64 = await fileToAvatar(file);
      const err = await social.updateAvatar(b64);
      if (err) onError(err);
      else soc.refresh();
    } catch {
      onError(t('fr.err.generic'));
    } finally {
      setBusy(false);
    }
  }

  const friends = soc.state?.friends ?? [];

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="chunk animate-scale-in w-full max-w-sm p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-extrabold text-text">{t('menu.profile')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-1.5 text-text-faint hover:text-text"
          >
            ✕
          </button>
        </div>

        {/* avatar + identity */}
        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            title={t('profile.changephoto')}
            className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-border-strong bg-bg"
          >
            {me?.avatar_b64 ? (
              <img src={me.avatar_b64} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Mascot mood="happy" size={44} />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="text-[10px] font-extrabold uppercase text-white">
                {busy ? '…' : t('profile.changephoto')}
              </span>
            </div>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              pickPhoto(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <div className="min-w-0">
            <div className="truncate text-base font-extrabold text-text">
              {userName || (me ? `@${me.username}` : '')}
            </div>
            {me && <div className="truncate text-sm font-bold text-accent">@{me.username}</div>}
            <div className="mt-0.5 truncate text-[11px] font-medium text-text-faint">{email}</div>
          </div>
        </div>

        {/* lifetime stats */}
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <div className="chunk px-2 py-3">
            <div className="font-mono text-base font-bold tabular-nums text-accent">
              {stats ? formatDurationShort(stats.totalSec) : '…'}
            </div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-text-faint">
              {t('profile.hours')}
            </div>
          </div>
          <div className="chunk px-2 py-3">
            <div className="font-mono text-base font-bold tabular-nums text-text">
              {stats ? stats.sessionCount : '…'}
            </div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-text-faint">
              {t('profile.sessions')}
            </div>
          </div>
          <button type="button" onClick={onOpenFriends} className="chunk px-2 py-3 hover:border-accent">
            <div className="font-mono text-base font-bold tabular-nums text-text">
              {friends.length}
            </div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-text-faint">
              {t('fr.title')}
            </div>
          </button>
        </div>

        {/* friend avatars strip */}
        {friends.length > 0 && (
          <button
            type="button"
            onClick={onOpenFriends}
            className="mt-4 flex w-full items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 hover:border-border-strong"
          >
            {friends.slice(0, 8).map((f) => (
              <span
                key={f.userId}
                title={`@${f.username}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-strong bg-bg text-[10px] font-extrabold uppercase text-text-dim"
              >
                {f.avatar ? (
                  <img src={f.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  f.username.slice(0, 2)
                )}
              </span>
            ))}
            {friends.length > 8 && (
              <span className="text-[11px] font-bold text-text-faint">+{friends.length - 8}</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

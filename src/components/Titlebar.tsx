import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { t } from '../lib/i18n';
import type { SocialHook } from '../hooks/useSocial';
import { Mascot } from './Mascot';

export interface TabDef {
  id: string;
  labelKey: string;
}

interface TitlebarProps {
  tabs: TabDef[];
  tab: string;
  onTab: (id: string) => void;
  statusChip: ReactNode;
  social: SocialHook;
  signedIn: boolean;
  userName: string | null;
  onOpenProfile: () => void;
}

function WinButton({
  onClick,
  danger,
  title,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-12 w-11 items-center justify-center text-text-dim transition-colors ${
        danger ? 'hover:bg-danger hover:text-white' : 'hover:bg-surface-hover hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}

export function Titlebar({
  tabs,
  tab,
  onTab,
  statusChip,
  social,
  signedIn,
  userName,
  onOpenProfile,
}: TitlebarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const me = social.state?.me ?? null;
  const win = () => getCurrentWindow();

  return (
    <header
      data-tauri-drag-region
      className="relative flex h-12 shrink-0 select-none items-center gap-2 border-b border-border pl-3"
    >
      {/* left: logo + settings gear */}
      <div data-tauri-drag-region className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-accent" data-tauri-drag-region />
        <span
          data-tauri-drag-region
          className="hidden text-sm font-semibold tracking-tight text-text lg:block"
        >
          Locked In
        </span>
        <button
          type="button"
          onClick={() => onTab('settings')}
          title={t('tab.settings')}
          className={`ml-1 flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            tab === 'settings'
              ? 'bg-surface-hover text-text'
              : 'text-text-dim hover:bg-surface-hover hover:text-text'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* center: nav */}
      <div data-tauri-drag-region className="flex min-w-0 flex-1 justify-center">
        <nav className="scrollbar-none flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-full border border-border bg-surface p-0.5">
          {tabs.map((tabDef) => (
            <button
              key={tabDef.id}
              type="button"
              onClick={() => onTab(tabDef.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium sm:px-3.5 ${
                tab === tabDef.id
                  ? 'bg-surface-hover text-text shadow-sm'
                  : 'text-text-dim hover:text-text'
              }`}
            >
              {t(tabDef.labelKey)}
              {tabDef.id === 'friends' && (social.state?.incoming.length ?? 0) > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-extrabold text-bg">
                  {social.state?.incoming.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* right: session chip + profile + window controls */}
      <div className="flex shrink-0 items-center gap-2">
        {statusChip}

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            title={me ? `@${me.username}` : t('menu.account')}
            className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-border-strong bg-surface transition-colors hover:border-accent"
          >
            {me?.avatar_b64 ? (
              <img src={me.avatar_b64} alt="" className="h-full w-full object-cover" />
            ) : (
              <Mascot mood="happy" size={20} />
            )}
          </button>

          {menuOpen && (
            <div className="animate-scale-in absolute right-0 top-10 z-50 w-56 rounded-xl border-2 border-border-strong bg-surface p-1.5 shadow-2xl shadow-black/50">
              {signedIn ? (
                <>
                  <div className="flex items-center gap-2.5 px-2.5 py-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-border-strong bg-bg">
                      {me?.avatar_b64 ? (
                        <img src={me.avatar_b64} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Mascot mood="happy" size={22} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-text">
                        {userName || (me ? `@${me.username}` : '…')}
                      </div>
                      {me && (
                        <div className="truncate text-[11px] font-medium text-text-faint">
                          @{me.username}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mx-1 my-1 border-t border-border" />
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenProfile();
                    }}
                    className="w-full rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold text-text hover:bg-surface-hover"
                  >
                    {t('menu.profile')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onTab('friends');
                    }}
                    className="w-full rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold text-text hover:bg-surface-hover"
                  >
                    {t('fr.title')}
                    {(social.state?.incoming.length ?? 0) > 0 && (
                      <span className="ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-extrabold text-bg">
                        {social.state?.incoming.length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onTab('settings');
                    }}
                    className="w-full rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold text-text hover:bg-surface-hover"
                  >
                    {t('tab.settings')}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('guest-mode');
                    window.location.reload();
                  }}
                  className="w-full rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold text-text hover:bg-surface-hover"
                >
                  {t('fr.guest.cta')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* window controls */}
        <div className="ml-1 flex items-center border-l border-border">
          <WinButton title={t('win.min')} onClick={() => win().minimize()}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4">
              <line x1="1" y1="5.5" x2="10" y2="5.5" />
            </svg>
          </WinButton>
          <WinButton title={t('win.max')} onClick={() => win().toggleMaximize()}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4">
              <rect x="1.5" y="1.5" width="8" height="8" rx="1" />
            </svg>
          </WinButton>
          <WinButton danger title={t('win.close')} onClick={() => win().close()}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4">
              <line x1="1.5" y1="1.5" x2="9.5" y2="9.5" />
              <line x1="9.5" y1="1.5" x2="1.5" y2="9.5" />
            </svg>
          </WinButton>
        </div>
      </div>
    </header>
  );
}

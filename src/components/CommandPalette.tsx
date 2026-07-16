import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../lib/i18n';

export interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

interface CommandPaletteProps {
  commands: Command[];
  onClose: () => void;
}

/** Ctrl+K quick-jump palette. */
export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => setIndex(0), [query]);

  useEffect(() => {
    const el = listRef.current?.children[index] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      const cmd = filtered[index];
      if (cmd) {
        onClose();
        cmd.run();
      }
    }
  }

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[70] flex items-start justify-center bg-black/60 px-6 pt-24 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="chunk animate-scale-in w-full max-w-md overflow-hidden p-0">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
          placeholder={t('cmd.placeholder')}
          className="w-full border-b-2 border-border-strong bg-transparent px-4 py-3.5 text-[15px] font-semibold text-text outline-none placeholder:font-medium placeholder:text-text-faint"
        />
        <div ref={listRef} className="max-h-72 overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-sm font-semibold text-text-faint">
              {t('cmd.none')}
            </div>
          )}
          {filtered.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onMouseEnter={() => setIndex(i)}
              onClick={() => {
                onClose();
                c.run();
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${
                i === index ? 'bg-surface-hover text-text' : 'text-text-dim'
              }`}
            >
              <span>{c.label}</span>
              {c.hint && (
                <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] font-bold text-text-faint">
                  {c.hint}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="border-t border-border px-3.5 py-2 text-[10px] font-bold text-text-faint">
          ↑↓ · Enter · Esc
        </div>
      </div>
    </div>
  );
}

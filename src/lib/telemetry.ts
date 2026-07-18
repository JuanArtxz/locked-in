// Opt-in crash telemetry. OFF by default; the toggle lives in Settings →
// System. Reports carry app version, OS and the error — NEVER message
// content, usernames or file paths beyond what the stack trace itself holds.
// Server side caps at 10/user/day and self-GCs after 30 days.

import { currentUser, supabase } from './cloud';

let enabled = false;
let installed = false;

export function setTelemetryEnabled(on: boolean): void {
  enabled = on;
}

const DAY_KEY = 'telemetry-day';
const COUNT_KEY = 'telemetry-count';

function underLocalCap(): boolean {
  const today = new Date().toDateString();
  if (localStorage.getItem(DAY_KEY) !== today) {
    localStorage.setItem(DAY_KEY, today);
    localStorage.setItem(COUNT_KEY, '0');
  }
  const n = Number(localStorage.getItem(COUNT_KEY) ?? '0');
  if (n >= 5) return false;
  localStorage.setItem(COUNT_KEY, String(n + 1));
  return true;
}

async function report(message: string, stack: string | null): Promise<void> {
  if (!enabled || !underLocalCap()) return;
  try {
    const user = await currentUser();
    if (!user) return; // insert policy requires auth
    await supabase.from('crash_reports').insert({
      user_id: user.id,
      app_version: (window as { __APP_VERSION__?: string }).__APP_VERSION__ ?? null,
      os: navigator.userAgent,
      message,
      stack,
    });
  } catch {
    // telemetry must never cause its own error loop
  }
}

/** Installs global error hooks once. Safe to call multiple times. */
export function installTelemetry(): void {
  if (installed) return;
  installed = true;
  window.addEventListener('error', (e) => {
    report(String(e.message ?? 'error'), e.error instanceof Error ? (e.error.stack ?? null) : null);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    report(
      r instanceof Error ? r.message : String(r ?? 'unhandled rejection'),
      r instanceof Error ? (r.stack ?? null) : null,
    );
  });
}

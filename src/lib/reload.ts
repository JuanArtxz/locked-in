// Internal reloads (logout, opening the login gate, cloud restore) go through
// warmReload() so the boot splash knows to skip itself — the 5s pet screen is
// a COLD-start ritual, not something to sit through on every screen hop.

export function warmReload(): void {
  sessionStorage.setItem('warm-reload', '1');
  window.location.reload();
}

/** True exactly once after a warmReload(); cold starts return false. */
export function consumeWarmReload(): boolean {
  const warm = sessionStorage.getItem('warm-reload') === '1';
  sessionStorage.removeItem('warm-reload');
  return warm;
}

import { getVersion } from '@tauri-apps/api/app';

/**
 * Where the app looks for the latest release info. A tiny JSON you host
 * (GitHub raw works great):
 *   { "version": "0.3.0", "url": "https://github.com/<user>/<repo>/releases/latest" }
 * Bump `version` + upload the new installer → everyone gets the update popup.
 */
export const UPDATE_MANIFEST_URL =
  'https://raw.githubusercontent.com/brgamesjao-blip/locked-in/main/latest.json';

export interface UpdateManifest {
  version: string;
  url: string;
}

function isNewer(remote: string, local: string): boolean {
  const r = remote.split('.').map((n) => parseInt(n, 10) || 0);
  const l = local.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const a = r[i] ?? 0;
    const b = l[i] ?? 0;
    if (a !== b) return a > b;
  }
  return false;
}

/** Returns the manifest when a newer version exists, null otherwise. */
export async function checkForUpdate(): Promise<UpdateManifest | null> {
  const res = await fetch(UPDATE_MANIFEST_URL, { cache: 'no-store' });
  if (!res.ok) return null;
  const m = (await res.json()) as UpdateManifest;
  if (typeof m.version !== 'string' || typeof m.url !== 'string') return null;
  if (!/^https:\/\//.test(m.url)) return null;
  const current = await getVersion();
  return isNewer(m.version, current) ? m : null;
}

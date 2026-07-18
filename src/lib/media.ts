// Chat media (images/voice) live in Supabase Storage, NOT in Postgres rows.
//
// SECURITY MODEL:
// - The blob uploaded to Storage is ciphertext: secretbox (XSalsa20-Poly1305)
//   with a fresh random 32-byte key per file.
// - That key + nonce travel INSIDE the E2E-encrypted message body (crypto_box),
//   so only the two chat participants can ever open the blob. The bucket being
//   public-read only exposes ciphertext under unguessable uuid paths.
// - Wire marker (the message plaintext for kinds image/voice):
//   {"mv":1,"p":"<uid>/<uuid>.bin","k":"<b64 key>","n":"<b64 nonce>","m":"<mime>"}
// - Old messages carry inline "data:" URLs — both formats render forever.

import sodium from 'libsodium-wrappers-sumo';
import { currentUser, supabase } from './cloud';

const BUCKET = 'chatmedia';

interface MediaMarker {
  mv: 1;
  p: string;
  k: string;
  n: string;
  m: string;
}

const b64 = (u: Uint8Array) => sodium.to_base64(u, sodium.base64_variants.ORIGINAL);
const unb64 = (s: string) => sodium.from_base64(s, sodium.base64_variants.ORIGINAL);

export function isMediaMarker(text: string | null): boolean {
  return !!text && text.startsWith('{"mv":1,');
}

function parseMarker(text: string): MediaMarker | null {
  try {
    const m = JSON.parse(text) as MediaMarker;
    return m && m.mv === 1 && m.p && m.k && m.n ? m : null;
  } catch {
    return null;
  }
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const comma = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || comma < 0) return null;
  const head = dataUrl.slice(5, comma); // "image/jpeg;base64"
  const mime = head.split(';')[0] || 'application/octet-stream';
  const bin = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime };
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

/**
 * Encrypts a data-url and uploads it to Storage. Returns the marker string to
 * send as the message body, or null on any failure (caller falls back to the
 * old inline data-url so chat keeps working offline).
 */
export async function uploadEncrypted(dataUrl: string): Promise<string | null> {
  try {
    await sodium.ready;
    const user = await currentUser();
    if (!user) return null;
    const parsed = dataUrlToBytes(dataUrl);
    if (!parsed) return null;
    const key = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const ct = sodium.crypto_secretbox_easy(parsed.bytes, nonce, key);
    const path = `${user.id}/${crypto.randomUUID()}.bin`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, new Blob([ct.buffer as ArrayBuffer]), {
        contentType: 'application/octet-stream',
        upsert: false,
      });
    if (error) return null;
    const marker: MediaMarker = { mv: 1, p: path, k: b64(key), n: b64(nonce), m: parsed.mime };
    return JSON.stringify(marker);
  } catch {
    return null;
  }
}

// decrypted media, keyed by storage path — a chat re-render never refetches
const mediaCache = new Map<string, string>();

/** Marker string → decrypted data-url (downloads + opens the blob, cached). */
export async function resolveMedia(text: string): Promise<string | null> {
  const marker = parseMarker(text);
  if (!marker) return null;
  const hit = mediaCache.get(marker.p);
  if (hit) return hit;
  try {
    await sodium.ready;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(marker.p);
    const res = await fetch(data.publicUrl);
    if (!res.ok) return null;
    const ct = new Uint8Array(await res.arrayBuffer());
    const plain = sodium.crypto_secretbox_open_easy(ct, unb64(marker.n), unb64(marker.k));
    const url = bytesToDataUrl(plain, marker.m || 'application/octet-stream');
    mediaCache.set(marker.p, url);
    return url;
  } catch {
    return null;
  }
}

/** Best-effort delete of the storage object behind a media message (own only). */
export async function deleteMedia(text: string | null): Promise<void> {
  if (!text) return;
  const marker = parseMarker(text);
  if (!marker) return;
  await supabase.storage.from(BUCKET).remove([marker.p]).catch(() => {});
}

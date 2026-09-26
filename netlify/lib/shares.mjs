import { getStore } from '@netlify/blobs';

export const STORE_NAME = 'picking-lists';
export const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Strong consistency so a link works the instant it is created.
export const shareStore = () => getStore({ name: STORE_NAME, consistency: 'strong' });

export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });

/** URL-safe id, ~16 chars. Long enough that links are not guessable. */
export function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Blobs has no native TTL, so expiry is enforced here: the timestamp travels
 * with the payload and a stale entry is deleted the first time it is read.
 * Returns { ok, share } or { ok: false, reason: 'not_found' | 'expired' }.
 */
export async function readShare(id) {
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) return { ok: false, reason: 'not_found' };

  const store = shareStore();
  let share;
  try {
    share = await store.get(id, { type: 'json' });
  } catch {
    return { ok: false, reason: 'not_found' };
  }
  if (!share) return { ok: false, reason: 'not_found' };

  if (!share.expiresAt || Date.parse(share.expiresAt) <= Date.now()) {
    try { await store.delete(id); } catch { /* best effort */ }
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, share };
}

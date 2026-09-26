import { shareStore, newId, json, TTL_MS } from '../lib/shares.mjs';

export const config = { path: '/api/share-create', method: ['POST'] };

const MAX_ITEMS = 2000;
const MAX_BODY_BYTES = 512 * 1024;

const str = (v, max) => String(v == null ? '' : v).slice(0, max).trim();

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413);

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (!Array.isArray(body?.items) || body.items.length === 0) {
    return json({ error: 'no_items' }, 400);
  }
  if (body.items.length > MAX_ITEMS) return json({ error: 'too_many_items' }, 413);

  // Normalise server-side: the picking page trusts only these fields.
  const items = body.items.map((it, i) => ({
    k: String(i),
    order: str(it.order, 32),
    title: str(it.title, 200),
    brand: str(it.brand, 80),
    name: str(it.name, 200),
    size: str(it.size, 16),
    qty: Number.isFinite(+it.qty) && +it.qty > 0 ? Math.min(Math.floor(+it.qty), 9999) : 1,
    prepared: !!it.prepared,
  })).filter((it) => it.name || it.title);

  if (items.length === 0) return json({ error: 'no_items' }, 400);

  const now = Date.now();
  const share = {
    v: 1,
    label: str(body.label, 80) || 'Picking List',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TTL_MS).toISOString(),
    items,
  };

  const id = newId();
  try {
    await shareStore().setJSON(id, share, { metadata: { expiresAt: share.expiresAt } });
  } catch (err) {
    return json({ error: 'store_unavailable', detail: String(err?.message || err) }, 502);
  }

  return json({
    id,
    url: `${new URL(req.url).origin}/l/${id}`,
    expiresAt: share.expiresAt,
    count: items.length,
  }, 201);
};

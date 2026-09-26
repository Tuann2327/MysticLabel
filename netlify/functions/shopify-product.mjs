import { readShare, json } from '../lib/shares.mjs';
import { shopifyEnv, lookupProduct } from '../lib/shopify.mjs';

export const config = { path: '/api/product', method: ['GET'] };

export default async (req) => {
  const url = new URL(req.url);
  const shareId = url.searchParams.get('id');
  const term = (url.searchParams.get('q') || '').trim();

  // The endpoint only answers for a live picking list, so it stops working
  // when the share expires rather than staying open forever.
  const share = await readShare(shareId);
  if (!share.ok) return json({ error: share.reason }, share.reason === 'expired' ? 410 : 403);

  if (!term) return json({ error: 'missing_query' }, 400);

  const env = shopifyEnv();
  if (!env) return json({ error: 'shopify_not_configured' }, 500);

  let node, withInventory;
  try {
    ({ node, withInventory } = await lookupProduct(env.store, env.token, term));
  } catch (err) {
    return json({ error: String(err?.message || err) }, 502);
  }

  if (!node) return json({ found: false, query: term });

  const numericId = String(node.id || '').split('/').pop();

  return json({
    found: true,
    title: node.title || '',
    vendor: node.vendor || '',
    image: node.featuredImage?.url || null,
    variants: (node.variants?.nodes || []).map((v) => ({
      title: v.title || '',
      inventory: withInventory && typeof v.inventoryQuantity === 'number' ? v.inventoryQuantity : null,
    })),
    adminUrl: numericId
      ? `https://admin.shopify.com/store/${env.store}/products/${numericId}`
      : null,
  }, 200, { 'Cache-Control': 'private, max-age=120' });
};

import { readShare, json } from '../lib/shares.mjs';

export const config = { path: '/api/product', method: ['GET'] };

const API_VERSION = '2024-10';

const FIELDS = (withInventory) => `
  id
  title
  vendor
  featuredImage { url }
  variants(first: 50) { nodes { title${withInventory ? '\n      inventoryQuantity' : ''} } }
`;

const query = (withInventory) => `
  query Lookup($q: String!) {
    products(first: 1, query: $q) {
      nodes {${FIELDS(withInventory)}}
    }
  }
`;

/** Shopify search syntax: escape backslashes and quotes before interpolating. */
const escapeTerm = (t) => t.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

function candidateQueries(term) {
  const clean = term.replace(/\s+/g, ' ').trim();
  const words = clean.split(' ').filter(Boolean);
  const out = [`title:"${escapeTerm(clean)}"`, escapeTerm(clean)];
  if (words.length > 2) out.push(escapeTerm(words.slice(0, 2).join(' ')));
  return out;
}

async function graphql(store, token, q, withInventory) {
  const res = await fetch(`https://${store}.myshopify.com/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: query(withInventory), variables: { q } }),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Shopify returned ${res.status}`);
  }
  return { ok: res.ok, status: res.status, parsed };
}

const isScopeError = (errors) =>
  (errors || []).some((e) =>
    /access|scope|permission/i.test(String(e?.message || '')) ||
    /ACCESS_DENIED/i.test(String(e?.extensions?.code || ''))
  );

export default async (req) => {
  const url = new URL(req.url);
  const shareId = url.searchParams.get('id');
  const term = (url.searchParams.get('q') || '').trim();

  // The endpoint only answers for a live picking list, so it stops working
  // when the share expires rather than staying open forever.
  const share = await readShare(shareId);
  if (!share.ok) return json({ error: share.reason }, share.reason === 'expired' ? 410 : 403);

  if (!term) return json({ error: 'missing_query' }, 400);

  const store = process.env.SHOPIFY_STORE;
  const token = process.env.SHOPIFY_TOKEN;
  if (!store || !token) return json({ error: 'shopify_not_configured' }, 500);

  let withInventory = true;
  let product = null;

  try {
    for (const q of candidateQueries(term)) {
      let { ok, status, parsed } = await graphql(store, token, q, withInventory);

      // Token lacks read_inventory — degrade rather than fail the whole sheet.
      if (withInventory && isScopeError(parsed?.errors)) {
        withInventory = false;
        ({ ok, status, parsed } = await graphql(store, token, q, withInventory));
      }
      if (!ok) return json({ error: `shopify_${status}` }, 502);
      if (parsed?.errors?.length) {
        return json({ error: parsed.errors[0]?.message || 'shopify_graphql_error' }, 502);
      }

      const node = parsed?.data?.products?.nodes?.[0];
      if (node) { product = node; break; }
    }
  } catch (err) {
    return json({ error: String(err?.message || err) }, 502);
  }

  if (!product) return json({ found: false, query: term });

  const numericId = String(product.id || '').split('/').pop();

  return json({
    found: true,
    title: product.title || '',
    vendor: product.vendor || '',
    image: product.featuredImage?.url || null,
    variants: (product.variants?.nodes || []).map((v) => ({
      title: v.title || '',
      inventory: withInventory && typeof v.inventoryQuantity === 'number' ? v.inventoryQuantity : null,
    })),
    adminUrl: numericId ? `https://admin.shopify.com/store/${store}/products/${numericId}` : null,
  }, 200, { 'Cache-Control': 'private, max-age=120' });
};

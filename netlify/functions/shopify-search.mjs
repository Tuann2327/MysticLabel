import { json } from '../lib/shares.mjs';
import { shopifyEnv, graphqlRequest, escapeTerm, isScopeError } from '../lib/shopify.mjs';

export const config = { path: '/api/product-search', method: ['GET'] };

/** Decant sizes only — anything above 10ml is a full bottle, not a sample. */
const MAX_SAMPLE_ML = 10;

const SEARCH = `
  query Search($q: String!) {
    products(first: 25, query: $q, sortKey: RELEVANCE) {
      nodes {
        id
        title
        vendor
        featuredImage { url(transform: { maxWidth: 96, maxHeight: 96 }) }
        variants(first: 60) { nodes { id title } }
      }
    }
  }
`;

const RECENT = `
  query Recent {
    products(first: 25, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        id
        title
        vendor
        featuredImage { url(transform: { maxWidth: 96, maxHeight: 96 }) }
        variants(first: 60) { nodes { id title } }
      }
    }
  }
`;

/** "Sample - 3ml" -> 3. Returns null when the variant carries no ml size. */
export function variantMl(title) {
  const m = String(title || '').match(/(\d+(?:\.\d+)?)\s*ml/i);
  return m ? parseFloat(m[1]) : null;
}

export default async (req) => {
  const term = (new URL(req.url).searchParams.get('q') || '').trim();

  const env = shopifyEnv();
  if (!env) return json({ error: 'shopify_not_configured' }, 500);

  let parsed, ok, status;
  try {
    ({ ok, status, parsed } = term
      ? await graphqlRequest(env.store, env.token, SEARCH, { q: escapeTerm(term) })
      : await graphqlRequest(env.store, env.token, RECENT, {}));
  } catch (err) {
    return json({ error: String(err?.message || err) }, 502);
  }

  if (!ok) return json({ error: `shopify_${status}` }, 502);
  if (parsed?.errors?.length) {
    return json({
      error: isScopeError(parsed.errors)
        ? 'Token is missing the read_products scope'
        : (parsed.errors[0]?.message || 'shopify_graphql_error'),
    }, 502);
  }

  // Keep only products that actually have a decant-sized variant to offer.
  const products = (parsed?.data?.products?.nodes || [])
    .map((p) => ({
      id: p.id,
      title: p.title || '',
      vendor: p.vendor || '',
      image: p.featuredImage?.url || null,
      variants: (p.variants?.nodes || [])
        .map((v) => ({ id: v.id, title: v.title || '', ml: variantMl(v.title) }))
        .filter((v) => v.ml !== null && v.ml <= MAX_SAMPLE_ML)
        .sort((a, b) => a.ml - b.ml),
    }))
    .filter((p) => p.variants.length > 0);

  return json({ products, query: term }, 200, { 'Cache-Control': 'private, max-age=60' });
};

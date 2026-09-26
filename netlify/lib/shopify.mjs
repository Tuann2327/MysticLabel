const API_VERSION = '2024-10';

export const shopifyEnv = () => {
  const store = process.env.SHOPIFY_STORE;
  const token = process.env.SHOPIFY_TOKEN;
  return store && token ? { store, token } : null;
};

/** Shopify search syntax: escape backslashes and quotes before interpolating. */
export const escapeTerm = (t) =>
  String(t == null ? '' : t).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

export async function graphqlRequest(store, token, query, variables) {
  const res = await fetch(`https://${store}.myshopify.com/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
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

export const isScopeError = (errors) =>
  (errors || []).some((e) =>
    /access|scope|permission/i.test(String(e?.message || '')) ||
    /ACCESS_DENIED/i.test(String(e?.extensions?.code || ''))
  );

/* ------------------------------------------------------------------ *
 * Single product, full detail — backs the picking list's product sheet
 * ------------------------------------------------------------------ */

const detailQuery = (withInventory) => `
  query Lookup($q: String!) {
    products(first: 1, query: $q) {
      nodes {
        id
        title
        vendor
        featuredImage { url(transform: { maxWidth: 640, maxHeight: 640 }) }
        variants(first: 50) { nodes { title${withInventory ? '\n          inventoryQuantity' : ''} } }
      }
    }
  }
`;

/** Exact title first, then loosened, so a stripped name still resolves. */
export function candidateQueries(term) {
  const clean = String(term || '').replace(/\s+/g, ' ').trim();
  const words = clean.split(' ').filter(Boolean);
  const out = [`title:"${escapeTerm(clean)}"`, escapeTerm(clean)];
  if (words.length > 2) out.push(escapeTerm(words.slice(0, 2).join(' ')));
  return out;
}

export async function lookupProduct(store, token, term) {
  let withInventory = true;

  for (const q of candidateQueries(term)) {
    let { ok, status, parsed } = await graphqlRequest(store, token, detailQuery(withInventory), { q });

    // Token lacks read_inventory — degrade rather than fail the whole sheet.
    if (withInventory && isScopeError(parsed?.errors)) {
      withInventory = false;
      ({ ok, status, parsed } = await graphqlRequest(store, token, detailQuery(withInventory), { q }));
    }
    if (!ok) throw new Error(`shopify_${status}`);
    if (parsed?.errors?.length) throw new Error(parsed.errors[0]?.message || 'shopify_graphql_error');

    const node = parsed?.data?.products?.nodes?.[0];
    if (node) return { node, withInventory };
  }
  return { node: null, withInventory };
}

/* ------------------------------------------------------------------ *
 * Many products, thumbnail only — baked into a share so the phone
 * renders row photos with no extra requests
 * ------------------------------------------------------------------ */

const CHUNK = 20;

async function imageChunk(store, token, terms, exact) {
  const decls = terms.map((_, j) => `$q${j}: String!`).join(', ');
  const body = terms
    .map((_, j) => `p${j}: products(first: 1, query: $q${j}) { nodes { featuredImage { url(transform: { maxWidth: 96, maxHeight: 96 }) } } }`)
    .join('\n    ');

  const variables = {};
  terms.forEach((t, j) => {
    variables[`q${j}`] = exact ? `title:"${escapeTerm(t)}"` : escapeTerm(t);
  });

  const { ok, parsed } = await graphqlRequest(
    store, token, `query Images(${decls}) {\n    ${body}\n  }`, variables
  );
  if (!ok || parsed?.errors?.length) return new Map();

  const found = new Map();
  terms.forEach((t, j) => {
    const url = parsed?.data?.[`p${j}`]?.nodes?.[0]?.featuredImage?.url;
    if (url) found.set(t, url);
  });
  return found;
}

/**
 * Resolves thumbnails for many titles using aliased queries, so a 50-item
 * list costs a handful of requests rather than 50. Exact-title pass first,
 * then one looser pass for whatever missed. Never throws — a list without
 * photos is still a usable list.
 */
export async function lookupImages(store, token, terms) {
  const unique = [...new Set(terms.filter(Boolean))];
  const images = new Map();

  for (const exact of [true, false]) {
    const pending = unique.filter((t) => !images.has(t));
    if (pending.length === 0) break;

    for (let i = 0; i < pending.length; i += CHUNK) {
      try {
        const got = await imageChunk(store, token, pending.slice(i, i + CHUNK), exact);
        for (const [k, v] of got) images.set(k, v);
      } catch {
        /* skip this chunk; the rest of the list still gets photos */
      }
    }
  }
  return images;
}

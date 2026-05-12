export const handler = async (event) => {
  const store = process.env.SHOPIFY_STORE;
  const token = process.env.SHOPIFY_TOKEN;

  if (!store || !token) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing SHOPIFY_STORE or SHOPIFY_TOKEN environment variables' }),
    };
  }

  const apiPath = event.path.replace('/shopify-proxy', '');
  const queryString = event.rawQuery
    || new URLSearchParams(event.queryStringParameters || {}).toString();
  const url = `https://${store}.myshopify.com${apiPath}${queryString ? '?' + queryString : ''}`;
console.log('Fetching URL:', url); // ADD THIS

  try {
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
    });

    const body = await response.text();

    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(err) }),
    };
  }
};

import { readShare, json } from '../lib/shares.mjs';

export const config = { path: '/api/share', method: ['GET'] };

export default async (req) => {
  const id = new URL(req.url).searchParams.get('id');
  const result = await readShare(id);

  if (!result.ok) {
    return json({ error: result.reason }, result.reason === 'expired' ? 410 : 404);
  }
  return json(result.share);
};

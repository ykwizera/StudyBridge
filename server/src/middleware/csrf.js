import { HttpError } from '../lib/httpError.js';
import { env } from '../lib/env.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie auth: SameSite=Lax cookie, plus on every
 * state-changing request the Origin must match our client and a custom
 * header must be present (which browsers block cross-site without CORS).
 */
export function csrfProtection(req, _res, next) {
  if (SAFE.has(req.method)) return next();
  const origin = req.get('origin') || (req.get('referer') ? new URL(req.get('referer')).origin : null);
  if (origin !== env.CLIENT_ORIGIN) throw new HttpError(403, 'Bad origin');
  if (req.get('x-requested-with') !== 'studybridge') throw new HttpError(403, 'Missing CSRF header');
  next();
}

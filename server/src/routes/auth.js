import { HttpError } from '../lib/httpError.js';
import { COOKIE_NAME, findSession } from '../services/sessions.js';

/** Loads req.user / req.session if a valid cookie is present. Never rejects. */
export async function loadSession(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  const session = await findSession(token);
  if (session) {
    req.session = { id: session.id, token };
    const { passwordHash, ...user } = session.user;
    req.user = user;
  }
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  next();
}

/** Users flagged mustChangePassword may only reach auth endpoints. */
export function blockIfPasswordChangeRequired(req, _res, next) {
  if (req.user?.mustChangePassword) throw new HttpError(403, 'Password change required');
  next();
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  if (!roles.includes(req.user.role)) throw new HttpError(403, 'You do not have permission to do that');
  next();
};

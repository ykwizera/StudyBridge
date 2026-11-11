import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { env, isProd } from '../lib/env.js';

export const COOKIE_NAME = 'sb_session';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export const cookieOptions = () => ({
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
  maxAge: env.SESSION_TTL_HOURS * 3600 * 1000,
});

export async function createSession(userId, { ip, userAgent } = {}) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 3600 * 1000);
  await prisma.session.create({
    data: { id: sha256(token), userId, expiresAt, ip, userAgent: userAgent?.slice(0, 255) },
  });
  return { token, expiresAt };
}

export async function findSession(token) {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: sha256(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date() || !session.user.isActive) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session;
}

export const destroySession = (token) =>
  prisma.session.deleteMany({ where: { id: sha256(token) } });

export const destroyUserSessions = (userId, exceptSessionId) =>
  prisma.session.deleteMany({
    where: { userId, ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}) },
  });

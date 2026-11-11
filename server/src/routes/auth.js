import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/httpError.js';
import { DUMMY_HASH, hashPassword, passwordSchema, verifyPassword } from '../lib/password.js';
import { requireAuth } from '../middleware/auth.js';
import { audit } from '../services/audit.js';
import {
  COOKIE_NAME, cookieOptions, createSession, destroySession, destroyUserSessions,
} from '../services/sessions.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, try again later' },
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1).max(128) });

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  const ok = await verifyPassword(user?.passwordHash ?? DUMMY_HASH, password).catch(() => false);
  if (!user || !ok || !user.isActive) {
    await audit(null, {
      action: 'LOGIN_FAILED', entityType: 'User', entityId: user?.id ?? 'unknown',
      metadata: { email: email.toLowerCase() }, ip: req.ip,
    });
    throw new HttpError(401, 'Invalid email or password');
  }

  const { token } = await createSession(user.id, { ip: req.ip, userAgent: req.get('user-agent') });
  await audit(null, { actorId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id, ip: req.ip });

  res.cookie(COOKIE_NAME, token, cookieOptions());
  const { passwordHash, ...safe } = user;
  res.json({ user: safe });
});

router.post('/logout', async (req, res) => {
  if (req.session?.token) await destroySession(req.session.token);
  if (req.user) await audit(null, { actorId: req.user.id, action: 'LOGOUT', entityType: 'User', entityId: req.user.id, ip: req.ip });
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

const changeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = changeSchema.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });

  if (!(await verifyPassword(user.passwordHash, currentPassword)))
    throw new HttpError(400, 'Current password is incorrect');
  if (currentPassword === newPassword) throw new HttpError(400, 'Choose a different password');

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
    });
    await audit(tx, { actorId: user.id, action: 'PASSWORD_CHANGED', entityType: 'User', entityId: user.id, ip: req.ip });
  });
  await destroyUserSessions(user.id, req.session.id); // log out other devices
  res.json({ ok: true });
});

export default router;
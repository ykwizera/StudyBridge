import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/httpError.js';
import { hashPassword } from '../lib/password.js';
import { requireRole } from '../middleware/auth.js';
import { audit } from '../services/audit.js';
import { destroyUserSessions } from '../services/sessions.js';

const router = Router();
router.use(requireRole('ADMIN'));

const publicUser = { id: true, email: true, name: true, role: true, isActive: true, mustChangePassword: true, createdAt: true };
const roleEnum = z.enum(['ADMIN', 'DATA_MANAGER', 'DATA_COLLECTOR', 'ANALYST']);

router.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({ select: publicUser, orderBy: { createdAt: 'desc' } });
  res.json({ users });
});

const createSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  name: z.string().trim().min(1).max(100),
  role: roleEnum,
});

// Creates the account with a one-time temporary password, shown once to the admin.
router.post('/', async (req, res) => {
  const data = createSchema.parse(req.body);
  const temporaryPassword = crypto.randomBytes(12).toString('base64url') + 'aA1';

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { ...data, passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true },
      select: publicUser,
    });
    await audit(tx, { actorId: req.user.id, action: 'USER_CREATED', entityType: 'User', entityId: u.id, metadata: { role: u.role }, ip: req.ip });
    return u;
  });
  res.status(201).json({ user, temporaryPassword });
});

const updateSchema = z.object({ role: roleEnum.optional(), isActive: z.boolean().optional() });

router.patch('/:id', async (req, res) => {
  const changes = updateSchema.parse(req.body);
  if (req.params.id === req.user.id) throw new HttpError(400, 'You cannot change your own role or status');

  const before = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!before) throw new HttpError(404, 'User not found');

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id: before.id }, data: changes, select: publicUser });
    await audit(tx, {
      actorId: req.user.id, action: 'USER_UPDATED', entityType: 'User', entityId: u.id,
      metadata: { from: { role: before.role, isActive: before.isActive }, to: changes }, ip: req.ip,
    });
    return u;
  });
  if (changes.isActive === false || changes.role) await destroyUserSessions(user.id);
  res.json({ user });
});

export default router;

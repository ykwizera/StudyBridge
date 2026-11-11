import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const email = process.env.SEED_ADMIN_EMAIL;
const name = process.env.SEED_ADMIN_NAME || 'Administrator';
const password = process.env.SEED_ADMIN_PASSWORD;

if (!email || !password) {
  console.error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env');
  process.exit(1);
}

const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
if (existing) {
  console.log('Admin already exists:', existing.email);
} else {
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      name,
      role: 'ADMIN',
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      mustChangePassword: true,
    },
  });
  await prisma.auditLog.create({
    data: { action: 'USER_CREATED', entityType: 'User', entityId: user.id, metadata: { seed: true } },
  });
  console.log('Created admin:', user.email);
}
await prisma.$disconnect();

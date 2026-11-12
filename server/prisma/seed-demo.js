// Creates demo data so a Data Collector can try the upload page:
// one hospital, one project, one collector account, and the collector's membership in the project.
// Safe to run more than once.
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';

const prisma = new PrismaClient();
const COLLECTOR_EMAIL = 'collector@studybridge.local';
const COLLECTOR_PASSWORD = 'Collector-Demo-123';

const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
if (!admin) {
  console.error('No admin found. Run `npm run seed` first.');
  process.exit(1);
}

const hospital = await prisma.hospital.upsert({
  where: { code: 'DEMO-H1' },
  update: {},
  create: { name: 'Demo Hospital', code: 'DEMO-H1' },
});

let project = await prisma.project.findFirst({ where: { title: 'Demo Project' } });
if (!project) {
  project = await prisma.project.create({
    data: { title: 'Demo Project', description: 'Sample project for testing', createdById: admin.id },
  });
}

let collector = await prisma.user.findUnique({ where: { email: COLLECTOR_EMAIL } });
if (!collector) {
  collector = await prisma.user.create({
    data: {
      email: COLLECTOR_EMAIL,
      name: 'Demo Collector',
      role: 'DATA_COLLECTOR',
      passwordHash: await hashPassword(COLLECTOR_PASSWORD),
      mustChangePassword: true,
    },
  });
  console.log(`Created collector ${COLLECTOR_EMAIL} with temporary password ${COLLECTOR_PASSWORD}`);
} else {
  console.log('Collector already exists:', COLLECTOR_EMAIL);
}

await prisma.projectMember.upsert({
  where: { projectId_userId: { projectId: project.id, userId: collector.id } },
  update: {},
  create: { projectId: project.id, userId: collector.id },
});

console.log(`Hospital "${hospital.name}" and project "${project.title}" are ready.`);
await prisma.$disconnect();

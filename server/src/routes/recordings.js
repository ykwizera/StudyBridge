import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { HttpError } from '../lib/httpError.js';
import { requireRole } from '../middleware/auth.js';
import { audit } from '../services/audit.js';
import * as storage from '../services/storage.js';

const router = Router();
router.use(requireRole('DATA_COLLECTOR')); // everything in this file is for Data Collectors only

const CHUNK_SIZE = 8 * 1024 * 1024; // the browser sends the file in 8 MB pieces
const MAX_CHUNK = 16 * 1024 * 1024; // the server refuses any piece bigger than this
const ALLOWED_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'opus', 'flac', 'wma', 'amr', '3gp', 'webm'];

// Reference codes avoid look-alike characters (0/O, 1/I/L) and are random, never sequential.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const makeReferenceCode = () =>
  'SB-' + Array.from({ length: 6 }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');

// Recordings that are being written right now, so two requests can't write to one file at once.
const busy = new Set();

// The fields a collector gets to see for each of their recordings.
const listSelect = {
  id: true,
  referenceCode: true,
  interviewLabel: true,
  originalName: true,
  sizeBytes: true,
  stage: true,
  uploadStatus: true,
  createdAt: true,
  completedAt: true,
  project: { select: { title: true } },
  hospital: { select: { name: true } },
};

// Load a recording, but only if it belongs to the logged-in collector.
async function getOwn(req) {
  const rec = await prisma.recording.findUnique({ where: { id: req.params.id } });
  if (!rec || rec.uploadedById !== req.user.id) throw new HttpError(404, 'Recording not found');
  return rec;
}

// What the upload form needs: the collector's projects, active hospitals and the upload limits.
router.get('/options', async (req, res) => {
  const [memberships, hospitals] = await Promise.all([
    prisma.projectMember.findMany({
      where: { userId: req.user.id },
      select: { project: { select: { id: true, title: true } } },
    }),
    prisma.hospital.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  res.json({
    projects: memberships.map((m) => m.project),
    hospitals,
    maxBytes: env.MAX_UPLOAD_BYTES,
    chunkSize: CHUNK_SIZE,
    allowedExtensions: ALLOWED_EXTENSIONS,
  });
});

// Numbers for the dashboard cards.
router.get('/summary', async (req, res) => {
  const uploadedById = req.user.id;
  const [done, incomplete, byStage] = await Promise.all([
    prisma.recording.aggregate({
      where: { uploadedById, uploadStatus: 'COMPLETE' },
      _count: { _all: true },
      _sum: { sizeBytes: true },
    }),
    prisma.recording.count({ where: { uploadedById, uploadStatus: 'PENDING' } }),
    prisma.recording.groupBy({
      by: ['stage'],
      where: { uploadedById, uploadStatus: 'COMPLETE' },
      _count: { _all: true },
    }),
  ]);
  res.json({
    uploaded: done._count._all,
    totalBytes: Number(done._sum.sizeBytes ?? 0),
    incomplete,
    stages: Object.fromEntries(byStage.map((g) => [g.stage, g._count._all])),
  });
});

// All of this collector's recordings, newest first.
router.get('/', async (req, res) => {
  const recordings = await prisma.recording.findMany({
    where: { uploadedById: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: listSelect,
  });
  res.json({ recordings });
});

const createSchema = z.object({
  projectId: z.string().min(1),
  hospitalId: z.string().min(1),
  interviewLabel: z.string().trim().min(1, 'Enter an interview label').max(120),
  originalName: z.string().trim().min(1).max(255),
  mimeType: z.string().max(100).optional().default('application/octet-stream'),
  sizeBytes: z.number().int().positive(),
});

// Step 1 of an upload: register the recording. No audio is sent yet.
router.post('/', async (req, res) => {
  const data = createSchema.parse(req.body);

  if (data.sizeBytes > env.MAX_UPLOAD_BYTES) {
    throw new HttpError(413, `File is too large. The limit is ${Math.round(env.MAX_UPLOAD_BYTES / 1024 ** 3)} GB.`);
  }
  const ext = data.originalName.includes('.') ? data.originalName.split('.').pop().toLowerCase() : '';
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new HttpError(400, `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: data.projectId, userId: req.user.id } },
  });
  if (!member) throw new HttpError(403, 'You are not assigned to that project');

  const hospital = await prisma.hospital.findUnique({ where: { id: data.hospitalId } });
  if (!hospital || !hospital.isActive) throw new HttpError(400, 'Choose a valid hospital');

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const recording = await prisma.$transaction(async (tx) => {
        const created = await tx.recording.create({
          data: {
            referenceCode: makeReferenceCode(),
            projectId: data.projectId,
            hospitalId: data.hospitalId,
            interviewLabel: data.interviewLabel,
            originalName: data.originalName,
            uploadedById: req.user.id,
            objectKey: storage.newObjectKey(),
            mimeType: data.mimeType,
            sizeBytes: BigInt(data.sizeBytes),
          },
          select: { id: true, referenceCode: true },
        });
        await audit(tx, {
          actorId: req.user.id, action: 'RECORDING_UPLOAD_STARTED', entityType: 'Recording',
          entityId: created.id, metadata: { referenceCode: created.referenceCode, sizeBytes: data.sizeBytes }, ip: req.ip,
        });
        return created;
      });
      return res.status(201).json({ recording, chunkSize: CHUNK_SIZE });
    } catch (err) {
      // P2002 = "already exists": the random reference code collided, so try another one.
      if (err.code === 'P2002' && attempt < 4) continue;
      throw err;
    }
  }
});

// How much of this upload has arrived? The browser asks this to resume after an interruption.
router.get('/:id/status', async (req, res) => {
  const rec = await getOwn(req);
  const received = rec.uploadStatus === 'COMPLETE' ? Number(rec.sizeBytes) : await storage.partSize(rec.objectKey);
  res.json({
    received,
    size: Number(rec.sizeBytes),
    originalName: rec.originalName,
    uploadStatus: rec.uploadStatus,
  });
});

// Step 2 of an upload: receive one piece of the file. The piece must start exactly where the last one ended.
router.put('/:id/chunk', async (req, res) => {
  try {
    const rec = await getOwn(req);
    if (rec.uploadStatus !== 'PENDING') throw new HttpError(409, 'This upload is already complete');

    const offset = Number(req.query.offset);
    const length = Number(req.get('content-length'));
    if (!Number.isInteger(offset) || offset < 0) throw new HttpError(400, 'Bad offset');
    if (!Number.isInteger(length) || length <= 0) throw new HttpError(400, 'Missing Content-Length');
    if (length > MAX_CHUNK) throw new HttpError(413, 'Chunk too large');
    if (offset + length > Number(rec.sizeBytes)) throw new HttpError(400, 'Chunk goes past the end of the file');
    if (busy.has(rec.id)) throw new HttpError(409, 'Another chunk is still being written');

    busy.add(rec.id);
    try {
      const current = await storage.partSize(rec.objectKey);
      if (current !== offset) throw new HttpError(409, 'Offset mismatch', { received: current });

      const written = await storage.appendChunk(rec.objectKey, req, offset, length);
      res.json({ received: offset + written });
    } finally {
      busy.delete(rec.id);
    }
  } catch (err) {
    // Read and discard the rest of the upload so the browser can receive our error message.
    if (!req.readableEnded) req.resume();
    if (err.message === 'CHUNK_TOO_LARGE') throw new HttpError(413, 'Chunk larger than declared');
    throw err;
  }
});

// Step 3 of an upload: all pieces are in. Check the size, fingerprint the file, mark it complete.
router.post('/:id/complete', async (req, res) => {
  const rec = await getOwn(req);
  if (rec.uploadStatus === 'COMPLETE') {
    const existing = await prisma.recording.findUnique({ where: { id: rec.id }, select: listSelect });
    return res.json({ recording: existing });
  }
  if (busy.has(rec.id)) throw new HttpError(409, 'Upload is busy, try again in a moment');

  busy.add(rec.id);
  try {
    const size = await storage.partSize(rec.objectKey);
    if (size !== Number(rec.sizeBytes)) throw new HttpError(409, 'The file is incomplete', { received: size });

    const checksum = await storage.finalize(rec.objectKey);
    const recording = await prisma.$transaction(async (tx) => {
      const updated = await tx.recording.update({
        where: { id: rec.id },
        data: { uploadStatus: 'COMPLETE', checksum, completedAt: new Date() },
        select: listSelect,
      });
      await audit(tx, {
        actorId: req.user.id, action: 'RECORDING_UPLOADED', entityType: 'Recording',
        entityId: rec.id, metadata: { referenceCode: rec.referenceCode, sizeBytes: Number(rec.sizeBytes), checksum }, ip: req.ip,
      });
      return updated;
    });
    res.json({ recording });
  } finally {
    busy.delete(rec.id);
  }
});

// Throw away an unfinished upload. Finished recordings can't be deleted here.
router.delete('/:id', async (req, res) => {
  const rec = await getOwn(req);
  if (rec.uploadStatus !== 'PENDING') throw new HttpError(409, 'Completed recordings cannot be deleted');
  if (busy.has(rec.id)) throw new HttpError(409, 'Upload is busy, try again in a moment');

  await prisma.$transaction(async (tx) => {
    await tx.recording.delete({ where: { id: rec.id } });
    await audit(tx, {
      actorId: req.user.id, action: 'RECORDING_UPLOAD_DISCARDED', entityType: 'Recording',
      entityId: rec.id, metadata: { referenceCode: rec.referenceCode }, ip: req.ip,
    });
  });
  await storage.remove(rec.objectKey);
  res.json({ ok: true });
});

export default router;

import { ZodError } from 'zod';
import { HttpError } from '../lib/httpError.js';
import { isProd } from '../lib/env.js';

export function notFound(_req, res) {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Invalid input', details: err.flatten().fieldErrors });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err?.code === 'P2002') return res.status(409).json({ error: 'Already exists' });
  console.error(err);
  res.status(500).json({ error: isProd ? 'Server error' : err.message });
}

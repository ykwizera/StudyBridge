import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './lib/env.js';
import { loadSession, requireAuth, blockIfPasswordChangeRequired } from './middleware/auth.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler, notFound } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import recordingRoutes from './routes/recordings.js';

export const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true, env: env.NODE_ENV }));

app.use('/api', csrfProtection, loadSession);
app.use('/api/auth', authRoutes);

// Everything below needs a logged-in user who has set their own password.
app.use('/api', requireAuth, blockIfPasswordChangeRequired);
app.use('/api/users', userRoutes);
app.use('/api/recordings', recordingRoutes);

app.use(notFound);
app.use(errorHandler);

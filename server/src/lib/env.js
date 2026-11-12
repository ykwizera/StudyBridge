import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  CLIENT_ORIGIN: z.string().url(),
  SESSION_TTL_HOURS: z.coerce.number().default(12),

  // Where uploaded audio is stored on this computer (relative to the server folder).
  STORAGE_DIR: z.string().default('./storage'),
  // Largest allowed audio file, in bytes. 2147483648 = 2 GB.
  MAX_UPLOAD_BYTES: z.coerce.number().default(2147483648),
});

export const env = schema.parse(process.env);
export const isProd = env.NODE_ENV === 'production';

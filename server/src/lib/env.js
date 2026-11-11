import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  CLIENT_ORIGIN: z.string().url(),
  SESSION_TTL_HOURS: z.coerce.number().default(12),
});

export const env = schema.parse(process.env);
export const isProd = env.NODE_ENV === 'production';

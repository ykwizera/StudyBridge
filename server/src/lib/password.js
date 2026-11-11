import argon2 from 'argon2';
import { z } from 'zod';

export const hashPassword = (pw) => argon2.hash(pw, { type: argon2.argon2id });
export const verifyPassword = (hash, pw) => argon2.verify(hash, pw);

// Verified against when the email is unknown, to keep login timing similar.
export const DUMMY_HASH = await hashPassword('dummy-password-for-timing');

export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(128)
  .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p), 'Use upper case, lower case and a number');

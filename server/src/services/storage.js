// Stores audio files on disk. Everything that touches files lives here, so that
// later we can swap this one file for private S3 storage without changing the routes.
//
// A file being uploaded lives at  <key>.part  and is renamed to  <key>  when complete.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { env } from '../lib/env.js';

const ROOT = path.resolve(env.STORAGE_DIR);

// Turn a storage key into a full path, and refuse anything that escapes the storage folder.
function resolveKey(key) {
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error('Invalid storage key');
  return full;
}

const partPath = (key) => resolveKey(key) + '.part';

/** A random key such as recordings/2026/11/3f2b...  (no name, no hospital, nothing identifying). */
export function newObjectKey() {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `recordings/${now.getUTCFullYear()}/${month}/${crypto.randomUUID()}`;
}

/** How many bytes of an unfinished upload we already have. */
export async function partSize(key) {
  try {
    return (await fsp.stat(partPath(key))).size;
  } catch {
    return 0;
  }
}

/**
 * Append one chunk (a readable stream) to the unfinished file.
 * If anything goes wrong half way, the file is cut back to `expectedOffset`
 * so a retry can send the same chunk again cleanly.
 */
export async function appendChunk(key, stream, expectedOffset, maxBytes) {
  const file = partPath(key);
  await fsp.mkdir(path.dirname(file), { recursive: true });

  let written = 0;
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      written += chunk.length;
      if (written > maxBytes) return callback(new Error('CHUNK_TOO_LARGE'));
      callback(null, chunk);
    },
  });

  try {
    await pipeline(stream, limiter, fs.createWriteStream(file, { flags: 'a' }));
  } catch (err) {
    await fsp.truncate(file, expectedOffset).catch(() => {});
    throw err;
  }
  return written;
}

/** Finish an upload: fingerprint the file (SHA-256) and rename it to its final name. */
export async function finalize(key) {
  const part = partPath(key);
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(part)) hash.update(chunk);
  await fsp.rename(part, resolveKey(key));
  return hash.digest('hex');
}

/** Delete a file (finished or unfinished). */
export async function remove(key) {
  await fsp.rm(resolveKey(key), { force: true });
  await fsp.rm(partPath(key), { force: true });
}

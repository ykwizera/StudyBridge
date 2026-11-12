// Uploads a big file in 8 MB pieces ("chunks") so that:
//  - a dropped connection only costs one piece, not the whole file
//  - an upload can be resumed later, even after closing the browser
import { api, ApiError } from './client.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// fetch() can't report upload progress, so we use XMLHttpRequest for each piece.
function putChunk(recordingId, offset, blob, { onProgress, signal }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `/api/recordings/${recordingId}/chunk?offset=${offset}`);
    xhr.setRequestHeader('X-Requested-With', 'studybridge'); // the server's CSRF check needs this
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded);
    };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(xhr.status, data.error || 'Upload failed', data.details));
    };
    xhr.onerror = () => reject(new ApiError(0, 'Network error'));
    xhr.ontimeout = () => reject(new ApiError(0, 'Network timeout'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));

    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

/**
 * Upload `file` for an already-registered recording.
 * It asks the server how much it already has, then sends the rest piece by piece.
 * Each failed piece is retried with a growing pause before giving up.
 */
export async function uploadFile({ recordingId, file, chunkSize, onProgress, signal }) {
  const statusPath = `/recordings/${recordingId}/status`;
  let { received } = await api.get(statusPath);
  let failures = 0;
  onProgress?.(received, file.size);

  while (received < file.size) {
    if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError');

    const end = Math.min(received + chunkSize, file.size);
    try {
      const data = await putChunk(recordingId, received, file.slice(received, end), {
        signal,
        onProgress: (loaded) => onProgress?.(received + loaded, file.size),
      });
      received = data.received;
      failures = 0;
      onProgress?.(received, file.size);
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      // 4xx errors are real refusals (except 409/429), so retrying won't help.
      const hopeless = err.status >= 400 && err.status < 500 && err.status !== 409 && err.status !== 429;
      if (hopeless) throw err;

      failures += 1;
      if (failures > 6) {
        throw new Error('The connection keeps failing. Your progress is saved: use Resume in My uploads to continue.');
      }
      await sleep(Math.min(1000 * 2 ** failures, 15000));
      // Ask the server where we really are before trying again.
      try { received = (await api.get(statusPath)).received; } catch { /* still offline, loop will retry */ }
    }
  }

  const { recording } = await api.post(`/recordings/${recordingId}/complete`);
  return recording;
}

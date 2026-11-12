import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { uploadFile } from '../../api/upload.js';
import { formatBytes } from '../../lib/format.js';

const extOf = (name) => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');

export default function UploadAudio() {
  const [options, setOptions] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [projectId, setProjectId] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [label, setLabel] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | uploading | paused | done
  const [progress, setProgress] = useState({ sent: 0, total: 0 });
  const [result, setResult] = useState(null);
  const abortRef = useRef(null);
  const createdRef = useRef(false); // true once the server knows about this recording

  useEffect(() => {
    api.get('/recordings/options')
      .then((o) => {
        setOptions(o);
        if (o.projects.length === 1) setProjectId(o.projects[0].id);
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  // Warn before closing the tab in the middle of an upload.
  useEffect(() => {
    if (phase !== 'uploading') return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase]);

  const pickFile = (e) => {
    const chosen = e.target.files[0];
    setError('');
    if (!chosen) return setFile(null);
    if (!options.allowedExtensions.includes(extOf(chosen.name))) {
      setFile(null);
      return setError(`That file type isn't supported. Allowed: ${options.allowedExtensions.join(', ')}`);
    }
    if (chosen.size === 0) {
      setFile(null);
      return setError('That file is empty.');
    }
    if (chosen.size > options.maxBytes) {
      setFile(null);
      return setError(`That file is ${formatBytes(chosen.size)}. The limit is ${formatBytes(options.maxBytes)}.`);
    }
    setFile(chosen);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!file) return setError('Choose an audio file first.');

    const controller = new AbortController();
    abortRef.current = controller;
    createdRef.current = false;
    setPhase('uploading');
    setProgress({ sent: 0, total: file.size });

    try {
      const { recording, chunkSize } = await api.post('/recordings', {
        projectId,
        hospitalId,
        interviewLabel: label,
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      });
      createdRef.current = true;

      const done = await uploadFile({
        recordingId: recording.id,
        file,
        chunkSize,
        signal: controller.signal,
        onProgress: (sent, total) => setProgress({ sent, total }),
      });
      setResult(done);
      setPhase('done');
    } catch (err) {
      if (err.name === 'AbortError') return setPhase('paused');
      const suffix = createdRef.current ? ' The part already sent is saved; you can resume it from My uploads.' : '';
      setError(err.message + suffix);
      setPhase('idle');
    }
  };

  const reset = () => {
    setFile(null); setLabel(''); setResult(null); setError(''); setPhase('idle');
    setProgress({ sent: 0, total: 0 });
  };

  if (loadError) return <p className="rounded bg-red-50 p-3 text-red-700">{loadError}</p>;
  if (!options) return <p className="text-slate-500">Loading…</p>;

  if (options.projects.length === 0) {
    return (
      <div className="max-w-xl space-y-2">
        <h1 className="text-2xl font-semibold">Upload audio</h1>
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          You haven't been added to a project yet. Ask an administrator to add you, then come back.
        </p>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold">Upload complete</h1>
        <div className="rounded-xl border border-green-300 bg-green-50 p-4">
          <p>Your recording was uploaded and saved.</p>
          <p className="mt-2 text-sm">Reference code: <b className="font-mono">{result.referenceCode}</b></p>
        </div>
        <div className="flex gap-3">
          <button onClick={reset} className="rounded-lg bg-teal-700 px-4 py-2 text-white hover:bg-teal-800">
            Upload another
          </button>
          <Link to="/uploads" className="rounded-lg border px-4 py-2 hover:bg-slate-100">View my uploads</Link>
        </div>
      </div>
    );
  }

  const uploading = phase === 'uploading';
  const percent = progress.total ? Math.min(100, Math.floor((progress.sent / progress.total) * 100)) : 0;

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Upload audio</h1>
        <p className="text-slate-600">Files up to {formatBytes(options.maxBytes)}. Large files are sent in pieces and can be resumed.</p>
      </div>

      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {phase === 'paused' && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          Upload stopped. What was already sent is saved: open <Link to="/uploads" className="underline">My uploads</Link> to resume or discard it.
        </p>
      )}

      <form onSubmit={submit} className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium">Project
          <select required disabled={uploading} value={projectId} onChange={(e) => setProjectId(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2 font-normal">
            <option value="">Select a project</option>
            {options.projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </label>

        <label className="block text-sm font-medium">Hospital
          <select required disabled={uploading} value={hospitalId} onChange={(e) => setHospitalId(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2 font-normal">
            <option value="">Select a hospital</option>
            {options.hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </label>

        <label className="block text-sm font-medium">Interview label
          <input required disabled={uploading} maxLength={120} value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Maternity ward, patient interview 3" className="mt-1 w-full rounded border px-3 py-2 font-normal" />
        </label>

        <label className="block text-sm font-medium">Audio file
          <input type="file" required disabled={uploading}
            accept={options.allowedExtensions.map((x) => `.${x}`).join(',') + ',audio/*'}
            onChange={pickFile} className="mt-1 block w-full text-sm font-normal file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-2" />
        </label>
        {file && <p className="text-sm text-slate-600">{file.name} · {formatBytes(file.size)}</p>}

        {uploading && (
          <div className="space-y-1">
            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-teal-600 transition-all" style={{ width: `${percent}%` }} />
            </div>
            <p className="text-sm text-slate-600">{percent}% · {formatBytes(progress.sent)} of {formatBytes(progress.total)}</p>
            <p className="text-xs text-slate-400">Keep this tab open until the upload finishes.</p>
          </div>
        )}

        <div className="flex gap-3">
          {!uploading ? (
            <button className="rounded-lg bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800">Start upload</button>
          ) : (
            <button type="button" onClick={() => abortRef.current?.abort()} className="rounded-lg border px-4 py-2 hover:bg-slate-100">
              Stop upload
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

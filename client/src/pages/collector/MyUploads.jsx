import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { uploadFile } from '../../api/upload.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import { formatBytes, formatDate } from '../../lib/format.js';

export default function MyUploads() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(null); // upload being resumed: { id, sent, total }
  const [chunkSize, setChunkSize] = useState(8 * 1024 * 1024);
  const fileInput = useRef(null);
  const resumeTarget = useRef(null);

  const load = () =>
    api.get('/recordings').then((d) => setRows(d.recordings)).catch((e) => setError(e.message));

  useEffect(() => {
    load();
    api.get('/recordings/options').then((o) => setChunkSize(o.chunkSize)).catch(() => {});
  }, []);

  // "Resume" opens the file picker; the collector must choose the same file again.
  const startResume = (row) => {
    setError('');
    resumeTarget.current = row;
    fileInput.current.click();
  };

  const onFileChosen = async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // so the same file can be picked again later
    const row = resumeTarget.current;
    if (!file || !row) return;

    if (file.name !== row.originalName || file.size !== Number(row.sizeBytes)) {
      return setError(`Please choose the original file: ${row.originalName} (${formatBytes(Number(row.sizeBytes))}).`);
    }

    setActive({ id: row.id, sent: 0, total: file.size });
    try {
      await uploadFile({
        recordingId: row.id,
        file,
        chunkSize,
        onProgress: (sent, total) => setActive({ id: row.id, sent, total }),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setActive(null);
      load();
    }
  };

  const discard = async (row) => {
    if (!window.confirm(`Discard the unfinished upload "${row.interviewLabel}"? This cannot be undone.`)) return;
    try {
      await api.del(`/recordings/${row.id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const shown = (rows || []).filter((r) => {
    const q = query.trim().toLowerCase();
    return !q || r.interviewLabel.toLowerCase().includes(q) || r.referenceCode.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">My uploads</h1>
        <Link to="/upload" className="rounded-lg bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800">Upload audio</Link>
      </div>

      <input ref={fileInput} type="file" className="hidden" onChange={onFileChosen} />
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by interview label or code"
        className="w-full max-w-sm rounded border px-3 py-2 text-sm" />

      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-500">
            <tr>
              <th className="p-3">Code</th><th>Interview</th><th>Project</th><th>Hospital</th>
              <th>Size</th><th>Uploaded</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows === null && <tr><td className="p-4 text-slate-500" colSpan={8}>Loading…</td></tr>}
            {rows && shown.length === 0 && (
              <tr><td className="p-4 text-slate-500" colSpan={8}>
                {rows.length === 0 ? 'No recordings yet.' : 'No recordings match your search.'}
              </td></tr>
            )}
            {shown.map((r) => {
              const isActive = active?.id === r.id;
              const percent = isActive && active.total ? Math.floor((active.sent / active.total) * 100) : 0;
              return (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="p-3 font-mono">{r.referenceCode}</td>
                  <td>{r.interviewLabel}</td>
                  <td>{r.project.title}</td>
                  <td>{r.hospital.name}</td>
                  <td className="whitespace-nowrap">{formatBytes(Number(r.sizeBytes))}</td>
                  <td className="whitespace-nowrap">{formatDate(r.createdAt)}</td>
                  <td>
                    {isActive ? <span className="text-teal-700">Uploading… {percent}%</span>
                      : <StatusBadge uploadStatus={r.uploadStatus} stage={r.stage} />}
                  </td>
                  <td className="whitespace-nowrap pr-3 text-right">
                    {r.uploadStatus === 'PENDING' && !isActive && (
                      <>
                        <button onClick={() => startResume(r)} disabled={!!active} className="mr-3 text-teal-700 hover:underline disabled:opacity-40">Resume</button>
                        <button onClick={() => discard(r)} disabled={!!active} className="text-red-600 hover:underline disabled:opacity-40">Discard</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows && rows.length >= 200 && <p className="text-xs text-slate-400">Showing your 200 most recent recordings.</p>}
    </div>
  );
}

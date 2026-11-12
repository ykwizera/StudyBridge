import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { formatBytes, formatDate } from '../../lib/format.js';

function Card({ label, value, to, hint }) {
  const body = (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
  return to ? <Link to={to} className="block hover:opacity-90">{body}</Link> : body;
}

export default function CollectorDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/recordings/summary'), api.get('/recordings')])
      .then(([s, list]) => {
        setSummary(s);
        setRecent(list.recordings.slice(0, 5));
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
          <p className="text-slate-600">Upload your interview recordings and follow their progress.</p>
        </div>
        <Link to="/upload" className="rounded-lg bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800">
          Upload audio
        </Link>
      </div>

      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Recordings uploaded" value={summary.uploaded} to="/uploads" />
          <Card label="Total size" value={formatBytes(summary.totalBytes)} />
          <Card
            label="Incomplete uploads"
            value={summary.incomplete}
            to="/uploads"
            hint={summary.incomplete ? 'Open My uploads to resume' : undefined}
          />
          <Card label="Fully completed" value={summary.stages.COMPLETED ?? 0} hint="Transcribed, translated and approved" />
        </div>
      )}

      <section className="rounded-xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">Recent uploads</h2>
          <Link to="/uploads" className="text-sm text-teal-700 hover:underline">View all</Link>
        </div>
        {recent.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Nothing uploaded yet. Use “Upload audio” to add your first recording.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-4 py-2">Code</th><th>Interview</th><th>Size</th><th>Date</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2 font-mono">{r.referenceCode}</td>
                    <td>{r.interviewLabel}</td>
                    <td>{formatBytes(Number(r.sizeBytes))}</td>
                    <td>{formatDate(r.createdAt)}</td>
                    <td><StatusBadge uploadStatus={r.uploadStatus} stage={r.stage} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function ChangePassword() {
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [error, setError] = useState('');

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      await refresh();
      navigate('/');
    } catch (err) {
      setError(err.details?.newPassword?.[0] || err.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Set a new password</h1>
        <p className="text-sm text-slate-500">12+ characters with upper case, lower case and a number.</p>
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <input type="password" required placeholder="Current (temporary) password" value={currentPassword}
          onChange={(e) => setCurrent(e.target.value)} className="w-full rounded border px-3 py-2" autoComplete="current-password" />
        <input type="password" required placeholder="New password" value={newPassword}
          onChange={(e) => setNew(e.target.value)} className="w-full rounded border px-3 py-2" autoComplete="new-password" />
        <button className="w-full rounded bg-teal-700 py-2 text-white hover:bg-teal-800">Save password</button>
      </form>
    </div>
  );
}

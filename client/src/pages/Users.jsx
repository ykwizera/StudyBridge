import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { ROLE_LABELS } from '../components/Layout.jsx';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', role: 'DATA_COLLECTOR' });
  const [created, setCreated] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get('/users').then((d) => setUsers(d.users));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault(); setError(''); setCreated(null);
    try {
      const data = await api.post('/users', form);
      setCreated({ email: data.user.email, password: data.temporaryPassword });
      setForm({ name: '', email: '', role: 'DATA_COLLECTOR' });
      load();
    } catch (err) { setError(err.message); }
  };

  const update = async (id, changes) => {
    try { await api.patch(`/users/${id}`, changes); load(); }
    catch (err) { setError(err.message); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Users</h1>

      <form onSubmit={create} className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-4">
        <input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded border px-3 py-2" />
        <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded border px-3 py-2" />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded border px-3 py-2">
          {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="rounded bg-teal-700 px-3 py-2 text-white hover:bg-teal-800">Create user</button>
      </form>

      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {created && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          Temporary password for <b>{created.email}</b> (shown once):{' '}
          <code className="rounded bg-white px-2 py-1">{created.password}</code>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-500">
            <tr><th className="p-3">Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="p-3">{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <select value={u.role} onChange={(e) => update(u.id, { role: e.target.value })} className="rounded border px-2 py-1">
                    {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
                <td>{u.isActive ? 'Active' : 'Deactivated'}</td>
                <td className="pr-3 text-right">
                  <button onClick={() => update(u.id, { isActive: !u.isActive })} className="text-teal-700 hover:underline">
                    {u.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

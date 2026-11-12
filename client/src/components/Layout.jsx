import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export const ROLE_LABELS = {
  ADMIN: 'Administrator',
  DATA_MANAGER: 'Data Manager',
  DATA_COLLECTOR: 'Data Collector',
  ANALYST: 'Analyst',
};

// Sidebar links for each role. Hiding a link is only a convenience:
// the server is what really blocks people from things they shouldn't reach.
const NAV = {
  ADMIN: [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/users', label: 'Users' },
  ],
  DATA_MANAGER: [{ to: '/', label: 'Dashboard', end: true }],
  DATA_COLLECTOR: [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/upload', label: 'Upload audio' },
    { to: '/uploads', label: 'My uploads' },
    { to: '/tasks', label: 'My tasks' },
  ],
  ANALYST: [{ to: '/', label: 'Dashboard', end: true }],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false); // mobile menu

  const linkClass = ({ isActive }) =>
    `block rounded-lg px-3 py-2 text-sm font-medium ${
      isActive ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <div className="min-h-screen md:flex">
      {/* Top bar, phones only */}
      <div className="flex items-center justify-between border-b bg-white px-4 py-3 md:hidden">
        <span className="text-lg font-semibold text-teal-700">StudyBridge</span>
        <button onClick={() => setOpen(!open)} className="rounded border px-3 py-1 text-sm">
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`${open ? 'flex' : 'hidden'} flex-col border-r bg-white md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0`}
      >
        <div className="hidden px-5 py-5 md:block">
          <span className="text-xl font-semibold text-teal-700">StudyBridge</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-3">
          {NAV[user.role].map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-4 text-sm">
          <p className="font-medium text-slate-800">{user.name}</p>
          <p className="mb-3 text-slate-500">{ROLE_LABELS[user.role]}</p>
          <button onClick={logout} className="w-full rounded border px-3 py-1.5 hover:bg-slate-100">
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}

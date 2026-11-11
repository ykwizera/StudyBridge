import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export const ROLE_LABELS = {
  ADMIN: 'Administrator',
  DATA_MANAGER: 'Data Manager',
  DATA_COLLECTOR: 'Data Collector',
  ANALYST: 'Analyst',
};

// Nav items per role. Hiding links is for convenience only; the server enforces access.
const NAV = {
  ADMIN: [['/', 'Dashboard'], ['/users', 'Users']],
  DATA_MANAGER: [['/', 'Dashboard']],
  DATA_COLLECTOR: [['/', 'Dashboard']],
  ANALYST: [['/', 'Dashboard']],
};

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-semibold text-teal-700">StudyBridge</span>
            <nav className="flex gap-4 text-sm">
              {NAV[user.role].map(([to, label]) => (
                <NavLink key={to} to={to} end className={({ isActive }) =>
                  isActive ? 'font-medium text-teal-700' : 'text-slate-600 hover:text-slate-900'}>
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">{user.name} · {ROLE_LABELS[user.role]}</span>
            <button onClick={logout} className="rounded border px-3 py-1 hover:bg-slate-100">Sign out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4"><Outlet /></main>
    </div>
  );
}

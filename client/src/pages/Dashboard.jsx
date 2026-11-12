import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_LABELS } from '../components/Layout.jsx';
import CollectorDashboard from './collector/CollectorDashboard.jsx';

const HINTS = {
  ADMIN: 'Create users, hospitals and projects, and review audit logs.',
  DATA_MANAGER: 'Assign transcription and translation tasks, then review submissions.',
  ANALYST: 'Read approved English translations by reference code.',
};

// One URL ("/"), a different dashboard for each role.
export default function Dashboard() {
  const { user } = useAuth();

  if (user.role === 'DATA_COLLECTOR') return <CollectorDashboard />;

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
      <p className="text-slate-600">{ROLE_LABELS[user.role]}: {HINTS[user.role]}</p>
    </div>
  );
}

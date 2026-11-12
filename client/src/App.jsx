import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Users from './pages/Users.jsx';
import UploadAudio from './pages/collector/UploadAudio.jsx';
import MyUploads from './pages/collector/MyUploads.jsx';
import MyTasks from './pages/collector/MyTasks.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<ChangePassword />} />

      {/* Pages every logged-in user can open */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
        </Route>
      </Route>

      {/* Administrator only */}
      <Route element={<ProtectedRoute roles={['ADMIN']} />}>
        <Route element={<Layout />}>
          <Route path="/users" element={<Users />} />
        </Route>
      </Route>

      {/* Data Collector only */}
      <Route element={<ProtectedRoute roles={['DATA_COLLECTOR']} />}>
        <Route element={<Layout />}>
          <Route path="/upload" element={<UploadAudio />} />
          <Route path="/uploads" element={<MyUploads />} />
          <Route path="/tasks" element={<MyTasks />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

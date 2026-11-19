import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api } from './lib/api.js';
import { PageLoader, useUi } from './ui/ui.jsx';
import AuthPage from './pages/AuthPage.jsx';
import SetupPage from './pages/SetupPage.jsx';
import PendingPage from './pages/PendingPage.jsx';
import StudentShell from './student/StudentShell.jsx';

const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export default function App() {
  const [boot, setBoot] = useState(null);
  const [error, setError] = useState('');
  const { toast } = useUi();
  const navigate = useNavigate();
  const location = useLocation();

  const inviteTopic = new URLSearchParams(location.search).get('topic') || '';

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/api/bootstrap${inviteTopic ? `?topic=${encodeURIComponent(inviteTopic)}` : ''}`);
      setBoot(data);
      setError('');
      return data;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, [inviteTopic]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onExpired = () => setBoot((b) => (b && b.user ? { ...b, user: null } : b));
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const setUser = useCallback((user) => setBoot((b) => ({ ...b, user, needsSetup: false })), []);

  const patchUser = useCallback((patch) => setBoot((b) => (b?.user ? { ...b, user: { ...b.user, ...patch } } : b)), []);

  const logout = useCallback(async () => {
    try { await api.post('/api/auth/logout'); } catch { /* ignore */ }
    setBoot((b) => ({ ...b, user: null }));
    navigate('/');
    toast('התנתקת מהמערכת', 'info');
  }, [navigate, toast]);

  if (error && !boot) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-bold text-navy-900">{error}</p>
        <button className="underline text-sky-700 font-bold" onClick={load}>נסו שוב</button>
      </div>
    );
  }
  if (!boot) return <PageLoader label="טוען את סביבת הלמידה..." />;

  const ctx = { ...boot, settings: boot.settings, user: boot.user, setUser, patchUser, logout, reload: load, inviteTopic };
  const u = boot.user;

  let content;
  if (boot.needsSetup) content = <SetupPage />;
  else if (!u) content = <AuthPage />;
  else if (u.role === 'admin') {
    content = (
      <Suspense fallback={<PageLoader label="טוען את מרכז הניהול..." />}>
        <Routes>
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="/topic/:topicId/*" element={<StudentShell preview />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Suspense>
    );
  } else if (u.status !== 'approved') content = <PendingPage />;
  else {
    content = (
      <Routes>
        <Route path="/admin/*" element={<Navigate to="/" replace />} />
        <Route path="/*" element={<StudentShell />} />
      </Routes>
    );
  }

  return <AppCtx.Provider value={ctx}>{content}</AppCtx.Provider>;
}

import { useCallback, useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, Wand2, BarChart3, Settings as SettingsIcon, LogOut, Menu, X, Crown } from 'lucide-react';
import { useApp } from '../App.jsx';
import { api } from '../lib/api.js';
import { Logo, cx } from '../ui/ui.jsx';
import Overview from './Overview.jsx';
import Students from './Students.jsx';
import StudentDetail from './StudentDetail.jsx';
import Topics from './Topics.jsx';
import Editor from './Editor.jsx';
import Studio from './Studio.jsx';
import Reports from './Reports.jsx';
import SettingsPage from './SettingsPage.jsx';

export function useFetch(url, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    if (!url) return Promise.resolve();
    return api.get(url).then((d) => { setData(d); setError(''); return d; }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);
  useEffect(() => { load(); }, [load]);
  return { data, error, reload: load, setData };
}

const NAV = [
  { to: '/admin', end: true, label: 'לוח בקרה', icon: LayoutDashboard, color: 'text-st-blue' },
  { to: '/admin/students', label: 'תלמידים', icon: Users, color: 'text-st-green', badge: 'pending' },
  { to: '/admin/content', label: 'נושאים ותכנים', icon: BookOpen, color: 'text-st-orange' },
  { to: '/admin/studio', label: 'סטודיו AI', icon: Wand2, color: 'text-st-purple', glow: true },
  { to: '/admin/reports', label: 'דוחות וציונים', icon: BarChart3, color: 'text-st-teal' },
  { to: '/admin/settings', label: 'הגדרות', icon: SettingsIcon, color: 'text-slate-500' },
];

export function PageHeader({ title, subtitle, icon: Icon, color = 'bg-navy-900', actions }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-3">
        {Icon && <div className={cx('w-12 h-12 rounded-2xl text-white flex items-center justify-center shadow-[var(--shadow-card)]', color)}><Icon size={24} /></div>}
        <div>
          <h1 className="text-2xl sm:text-[28px] font-black leading-tight">{title}</h1>
          {subtitle && <p className="text-slate-500 text-sm mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export default function AdminApp() {
  const { user, logout } = useApp();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const location = useLocation();

  const refreshPending = useCallback(() => {
    api.get('/api/admin/overview').then((d) => setPending(d.kpis.pending)).catch(() => {});
  }, []);
  useEffect(() => { refreshPending(); const t = setInterval(refreshPending, 60000); return () => clearInterval(t); }, [refreshPending]);
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="p-4 pb-2 flex items-center justify-between">
        <div className="bg-white rounded-2xl px-2.5 py-1"><Logo className="h-12" /></div>
        <button className="lg:hidden p-2 text-white/70 cursor-pointer" onClick={() => setOpen(false)} aria-label="סגירה"><X /></button>
      </div>
      <div className="px-4 pb-3">
        <div className="text-[11px] font-black text-gold-300 tracking-wide">מרכז הניהול</div>
      </div>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto scroll-thin">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => cx('flex items-center gap-3 h-11 px-3 rounded-xl font-bold text-[15px] transition',
              isActive ? 'bg-white text-navy-900 shadow-sm' : 'text-white/80 hover:bg-white/10 hover:text-white')}>
            {({ isActive }) => (<>
              <n.icon size={20} className={isActive ? n.color : ''} />
              <span className="flex-1">{n.label}</span>
              {n.badge === 'pending' && pending > 0 && <span className="bg-st-red text-white text-[11px] font-black px-2 py-0.5 rounded-full">{pending}</span>}
              {n.glow && <span className="text-[10px] font-black bg-gradient-to-l from-gold-400 to-gold-300 text-navy-950 px-1.5 rounded-md">AI</span>}
            </>)}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-300 to-gold-500 text-navy-950 flex items-center justify-center"><Crown size={20} /></div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white truncate">{user.name}</div>
            <div className="text-[11px] text-white/50 truncate" dir="ltr">{user.email}</div>
          </div>
          <button onClick={logout} title="יציאה" className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"><LogOut size={18} /></button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pr-64">
      <aside className="hidden lg:block fixed right-0 top-0 bottom-0 w-64 bg-navy-900 z-30">{sidebar}</aside>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 bg-navy-950/60" onClick={() => setOpen(false)}>
          <aside className="absolute right-0 top-0 bottom-0 w-72 bg-navy-900 animate-[rise_.25s_ease]" onClick={(e) => e.stopPropagation()}>{sidebar}</aside>
        </div>
      )}
      <header className="lg:hidden sticky top-0 z-30 bg-navy-900 text-white h-14 flex items-center justify-between px-3">
        <button onClick={() => setOpen(true)} className="p-2 cursor-pointer" aria-label="תפריט"><Menu /></button>
        <span className="font-black">מרכז הניהול · עדי</span>
        <span className="w-10 text-left">{pending > 0 && <span className="bg-st-red text-xs font-black px-2 py-0.5 rounded-full">{pending}</span>}</span>
      </header>
      <main className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto">
        <Routes>
          <Route index element={<Overview onChange={refreshPending} />} />
          <Route path="students" element={<Students onChange={refreshPending} />} />
          <Route path="students/:id" element={<StudentDetail onChange={refreshPending} />} />
          <Route path="content" element={<Topics />} />
          <Route path="content/:id" element={<Editor />} />
          <Route path="studio" element={<Studio />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Overview onChange={refreshPending} />} />
        </Routes>
      </main>
    </div>
  );
}

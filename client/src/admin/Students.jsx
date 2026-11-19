import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Users, Search, UserPlus, ChevronDown, MoreHorizontal, MessageCircle, Pencil, KeyRound, LogOut, Trash2, ShieldCheck, Flame, Smartphone } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { Button, Card, Empty, PageLoader, StatusPill, cx, scoreColor, timeAgo, useUi, waLink } from '../ui/ui.jsx';
import { PageHeader, useFetch } from './AdminApp.jsx';
import { AccessModal, StudentFormModal, ResetPasswordModal } from './StudentModals.jsx';

export const STUDENT_STATUS = {
  pending: { label: 'ממתין לאישור', color: 'orange', stripe: 'border-r-st-orange', text: 'text-st-orange' },
  approved: { label: 'פעיל', color: 'green', stripe: 'border-r-st-green', text: 'text-st-green' },
  blocked: { label: 'מוקפא', color: 'red', stripe: 'border-r-st-red', text: 'text-st-red' },
};

// Menu is position:fixed so it is never clipped by scrollable tables.
function Dropdown({ trigger, children, align = 'left' }) {
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!pos) return undefined;
    const h = (e) => ref.current && !ref.current.contains(e.target) && !menuRef.current?.contains(e.target) && setPos(null);
    const close = () => setPos(null);
    document.addEventListener('mousedown', h);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { document.removeEventListener('mousedown', h); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [pos]);
  const toggle = () => {
    if (pos) return setPos(null);
    const r = ref.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom > 260;
    setPos({
      top: below ? r.bottom + 4 : undefined,
      bottom: below ? undefined : window.innerHeight - r.top + 4,
      left: align === 'left' ? Math.max(8, r.left) : undefined,
      right: align === 'right' ? Math.max(8, window.innerWidth - r.right) : undefined,
    });
  };
  return (
    <div className="relative" ref={ref}>
      <div onClick={toggle}>{trigger}</div>
      {pos && createPortal(
        <div ref={menuRef} onClick={() => setPos(null)} style={{ position: 'fixed', ...pos }}
          className="z-50 min-w-48 bg-white rounded-2xl border border-line shadow-[var(--shadow-pop)] p-1.5 animate-pop" dir="rtl">
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}
export function DItem({ icon: Icon, children, onClick, danger }) {
  return (
    <button onClick={onClick} className={cx('w-full flex items-center gap-2.5 px-3 h-9 rounded-xl text-sm font-semibold whitespace-nowrap cursor-pointer', danger ? 'text-rose-600 hover:bg-rose-50' : 'hover:bg-slate-100')}>
      {Icon && <Icon size={16} />}{children}
    </button>
  );
}
export { Dropdown };

export default function Students({ onChange }) {
  const { settings } = useApp();
  const { toast, confirm } = useUi();
  const navigate = useNavigate();
  const { data, reload } = useFetch('/api/admin/students');
  const [q, setQ] = useState('');
  const [grade, setGrade] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const [modal, setModal] = useState(null); // {type, student}

  const refresh = () => { reload(); onChange?.(); };

  const filtered = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    return data.students.filter((x) => (!grade || x.grade === grade)
      && (!s || x.name.toLowerCase().includes(s) || x.email.toLowerCase().includes(s) || (x.phone || '').replace(/\D/g, '').includes(s.replace(/\D/g, '') || '###')));
  }, [data, q, grade]);

  if (!data) return <PageLoader />;

  const setStatus = async (st, status) => {
    if (status === 'approved' && st.status === 'pending') return setModal({ type: 'access', student: st });
    try {
      await api.patch(`/api/admin/students/${st.id}`, { status });
      toast(`הסטטוס של ${st.name} עודכן ל"${STUDENT_STATUS[status].label}"`, 'success');
      refresh();
    } catch (e) { toast(e.message, 'error'); }
  };

  const remove = async (st) => {
    if (!(await confirm({ title: `למחוק את ${st.name}?`, message: 'כל ההתקדמות, הציונים וה-XP יימחקו לצמיתות. אפשר במקום זה להקפיא את החשבון.', confirmText: 'מחיקה לצמיתות', danger: true }))) return;
    try { await api.del(`/api/admin/students/${st.id}`); toast('התלמיד/ה נמחק/ה', 'success'); refresh(); } catch (e) { toast(e.message, 'error'); }
  };

  const logoutAll = async (st) => {
    try { await api.post(`/api/admin/students/${st.id}/logout-all`); toast('התלמיד/ה נותק/ה מכל המכשירים', 'success'); refresh(); } catch (e) { toast(e.message, 'error'); }
  };

  const groups = ['pending', 'approved', 'blocked'].map((k) => ({ key: k, ...STUDENT_STATUS[k], rows: filtered.filter((s) => s.status === k) }))
    .filter((g) => g.rows.length || g.key === 'approved');

  return (
    <div className="animate-rise">
      <PageHeader title="תלמידים" subtitle={`${data.students.filter((s) => s.status === 'approved').length} פעילים · ${data.students.filter((s) => s.status === 'pending').length} ממתינים לאישור`}
        icon={Users} color="bg-st-green"
        actions={<Button icon={UserPlus} onClick={() => setModal({ type: 'form' })}>תלמיד/ה חדש/ה</Button>} />

      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative flex-1 min-w-56 max-w-md">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="field !pr-10 !h-11" placeholder="חיפוש לפי שם, אימייל או טלפון" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="field !w-auto !h-11" value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">כל הכיתות</option>
          {settings.grades.map((g) => <option key={g}>{g}</option>)}
        </select>
      </div>

      {data.students.length === 0 ? (
        <Card><Empty icon={Users} title="עדיין אין תלמידים" action={<Button icon={UserPlus} onClick={() => setModal({ type: 'form' })}>הוספת תלמיד/ה</Button>}>
          שתפי את הקישור למערכת עם התלמידים – הם יירשמו ויופיעו כאן לאישור. אפשר גם להוסיף ידנית.
        </Empty></Card>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key}>
              <button onClick={() => setCollapsed({ ...collapsed, [g.key]: !collapsed[g.key] })} className={cx('flex items-center gap-2 font-black text-lg mb-2 cursor-pointer', g.text)}>
                <ChevronDown size={20} className={cx('transition', collapsed[g.key] && 'rotate-90')} />
                {g.key === 'pending' ? 'ממתינים לאישור' : g.key === 'approved' ? 'תלמידים פעילים' : 'חשבונות מוקפאים'}
                <span className="text-sm text-slate-400 font-bold">{g.rows.length}</span>
              </button>
              {!collapsed[g.key] && (
                <div className="bg-white rounded-2xl border border-line shadow-[var(--shadow-card)] overflow-x-auto scroll-thin">
                  <table className="w-full text-sm min-w-[960px]">
                    <thead>
                      <tr className="text-slate-500 text-xs font-bold border-b border-line">
                        <th className="text-right font-bold p-3 pr-4 w-[230px]">תלמיד/ה</th>
                        <th className="font-bold p-2 w-[125px]">סטטוס</th>
                        <th className="font-bold p-2">כיתה / הקבצה</th>
                        <th className="font-bold p-2">מסגרת</th>
                        <th className="font-bold p-2 w-[190px]">גישה</th>
                        <th className="font-bold p-2">XP השבוע</th>
                        <th className="font-bold p-2">דיוק</th>
                        <th className="font-bold p-2 w-[90px]">ממוצע מבחנים</th>
                        <th className="font-bold p-2">פעילות אחרונה</th>
                        <th className="p-2 w-12" />
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map((st) => (
                        <tr key={st.id} className={cx('border-b border-line last:border-0 hover:bg-slate-50/80 border-r-[6px]', g.stripe)}>
                          <td className="p-3 pr-4">
                            <button onClick={() => navigate(`/admin/students/${st.id}`)} className="flex items-center gap-2.5 text-right cursor-pointer group">
                              <span className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-lg shrink-0">{st.avatar || st.name.slice(0, 1)}</span>
                              <span className="min-w-0">
                                <span className="block font-bold text-navy-900 group-hover:text-[#0073ea] truncate max-w-40">{st.name}</span>
                                <span className="block text-xs text-slate-400 truncate max-w-40" dir="ltr">{st.phone || st.email}</span>
                              </span>
                            </button>
                          </td>
                          <td className="p-1.5">
                            <Dropdown align="right" trigger={<StatusPill cell color={STUDENT_STATUS[st.status].color} className="rounded-lg cursor-pointer" onClick={() => {}}>{STUDENT_STATUS[st.status].label}</StatusPill>}>
                              {Object.entries(STUDENT_STATUS).map(([k, v]) => (
                                <button key={k} onClick={() => setStatus(st, k)} className="w-full p-1 cursor-pointer"><StatusPill cell color={v.color} className="rounded-lg">{k === 'approved' && st.status === 'pending' ? 'אישור...' : v.label}</StatusPill></button>
                              ))}
                            </Dropdown>
                          </td>
                          <td className="p-2 text-center"><div className="font-semibold">{st.grade || '—'}</div><div className="text-xs text-slate-400">{st.level}</div></td>
                          <td className="p-2 text-center text-slate-600">{st.program || '—'}</td>
                          <td className="p-2">
                            <button onClick={() => setModal({ type: 'access', student: st })} className="w-full flex flex-wrap gap-1 justify-center cursor-pointer hover:opacity-80" title="עריכת הרשאות">
                              {st.access.grades.map((x) => <span key={x} className="bg-blue-50 text-blue-700 text-[11px] font-bold px-2 py-0.5 rounded-md">{x} (כל השכבה)</span>)}
                              {st.access.topicIds.length > 0 && <span className="bg-amber-50 text-amber-700 text-[11px] font-bold px-2 py-0.5 rounded-md">{st.access.topicIds.length} נושאים</span>}
                              {!st.access.grades.length && !st.access.topicIds.length && <span className="text-xs text-rose-500 font-bold">אין גישה – לחצי להגדרה</span>}
                            </button>
                          </td>
                          <td className="p-2 text-center">
                            <span className="font-black">{st.stats.weekXp}</span>
                            {st.streak > 0 && <span className="text-orange-500 text-xs font-bold mr-1 inline-flex items-center"><Flame size={12} />{st.streak}</span>}
                          </td>
                          <td className="p-2 text-center">
                            {st.stats.accuracy === null ? <span className="text-slate-300">—</span> : (
                              <div className="flex items-center gap-1.5 justify-center"><div className="w-14 h-2 bg-slate-100 rounded-full overflow-hidden"><div className={cx('h-full', st.stats.accuracy >= 75 ? 'bg-st-green' : st.stats.accuracy >= 55 ? 'bg-st-orange' : 'bg-st-red')} style={{ width: `${st.stats.accuracy}%` }} /></div><span className="text-xs font-bold">{st.stats.accuracy}%</span></div>
                            )}
                          </td>
                          <td className="p-1.5">{st.stats.examAvg === null ? <div className="text-center text-slate-300">—</div> : <StatusPill cell color={scoreColor(st.stats.examAvg)} className="rounded-lg">{st.stats.examAvg}</StatusPill>}</td>
                          <td className="p-2 text-center text-xs text-slate-500">{timeAgo(st.lastSeen)}{st.devices > 0 && <span className="block text-[10px] text-slate-400 inline-flex items-center gap-0.5"><Smartphone size={10} />{st.devices}</span>}</td>
                          <td className="p-2">
                            <Dropdown trigger={<button className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center cursor-pointer" aria-label="פעולות"><MoreHorizontal size={18} /></button>}>
                              {st.status === 'pending' && <DItem icon={ShieldCheck} onClick={() => setModal({ type: 'access', student: st })}>אישור ופתיחת גישה</DItem>}
                              <DItem icon={Pencil} onClick={() => setModal({ type: 'form', student: st })}>עריכת פרטים</DItem>
                              <DItem icon={ShieldCheck} onClick={() => setModal({ type: 'access', student: st })}>הרשאות גישה</DItem>
                              <DItem icon={KeyRound} onClick={() => setModal({ type: 'reset', student: st })}>איפוס סיסמה</DItem>
                              {st.phone && <a href={waLink(st.phone, `היי ${st.name.split(' ')[0]}, `)} target="_blank" rel="noreferrer"><DItem icon={MessageCircle}>וואטסאפ</DItem></a>}
                              <DItem icon={LogOut} onClick={() => logoutAll(st)}>ניתוק מכל המכשירים</DItem>
                              <div className="h-px bg-line my-1" />
                              <DItem icon={Trash2} danger onClick={() => remove(st)}>מחיקה</DItem>
                            </Dropdown>
                          </td>
                        </tr>
                      ))}
                      {g.rows.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-slate-400">אין תלמידים {q || grade ? 'שתואמים לחיפוש' : 'בקבוצה זו'}</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <AccessModal open={modal?.type === 'access'} student={modal?.student} onClose={() => setModal(null)} onSaved={refresh} />
      <StudentFormModal open={modal?.type === 'form'} student={modal?.student} onClose={() => setModal(null)} onSaved={refresh} />
      <ResetPasswordModal open={modal?.type === 'reset'} student={modal?.student} onClose={() => setModal(null)} />
    </div>
  );
}

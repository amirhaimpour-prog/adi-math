import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Wand2, Upload, ChevronDown, MoreHorizontal, Pencil, Eye, Share2, Copy, Download, Trash2, Sparkles, Users } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { Button, Card, Empty, Field, Modal, PageLoader, StatusPill, TOPIC_COLORS, cx, timeAgo, useUi, waLink } from '../ui/ui.jsx';
import { Rich } from '../lib/Rich.jsx';
import { PageHeader, useFetch } from './AdminApp.jsx';
import { Dropdown, DItem } from './Students.jsx';

const GROUP_COLORS = ['text-st-blue', 'text-st-purple', 'text-st-green', 'text-st-orange', 'text-st-pink', 'text-st-teal'];
const STRIPES = ['border-r-st-blue', 'border-r-st-purple', 'border-r-st-green', 'border-r-st-orange', 'border-r-st-pink', 'border-r-st-teal'];

export function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {Object.entries(TOPIC_COLORS).map(([k, c]) => (
        <button key={k} type="button" onClick={() => onChange(k)} title={k}
          className={cx('w-9 h-9 rounded-xl bg-gradient-to-l cursor-pointer transition', c.bg, value === k ? 'ring-4 ring-offset-2 ring-navy-900/30 scale-110' : 'opacity-80 hover:opacity-100')} />
      ))}
    </div>
  );
}

export function downloadJson(obj, name) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export default function Topics() {
  const { settings } = useApp();
  const { toast, confirm } = useUi();
  const navigate = useNavigate();
  const { data, reload } = useFetch('/api/admin/topics');
  const [newOpen, setNewOpen] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [f, setF] = useState({ title: '', grade: '', level: '', color: 'sky', description: '' });
  const fileRef = useRef(null);

  const groups = useMemo(() => {
    if (!data) return [];
    const m = new Map();
    for (const t of data.topics) {
      const g = t.grade || 'ללא כיתה';
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(t);
    }
    const order = settings.grades;
    return [...m.entries()].sort((a, b) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99));
  }, [data, settings.grades]);

  if (!data) return <PageLoader />;

  const create = async (e) => {
    e.preventDefault();
    try {
      const { topic } = await api.post('/api/admin/topics', f);
      toast('הנושא נוצר – עכשיו אפשר למלא אותו', 'success');
      navigate(`/admin/content/${topic.id}`);
    } catch (err) { toast(err.message, 'error'); }
  };

  const setStatus = async (t, status) => {
    try {
      await api.put(`/api/admin/topics/${t.id}`, { topic: { status } });
      toast(status === 'published' ? `"${t.title}" פורסם לתלמידים 🚀` : 'הנושא הוחזר לטיוטה', 'success');
      reload();
    } catch (err) { toast(err.message, 'error'); }
  };

  const duplicate = async (t) => {
    try { await api.post(`/api/admin/topics/${t.id}/duplicate`); toast('נוצר עותק (טיוטה)', 'success'); reload(); } catch (err) { toast(err.message, 'error'); }
  };
  const remove = async (t) => {
    if (!(await confirm({ title: `למחוק את "${t.title}"?`, message: 'הנושא, השאלות והמבחנים יימחקו. תוצאות מבחנים קודמות יישמרו בדוחות. מומלץ לייצא גיבוי לפני.', confirmText: 'מחיקה', danger: true }))) return;
    try { await api.del(`/api/admin/topics/${t.id}`); toast('הנושא נמחק', 'success'); reload(); } catch (err) { toast(err.message, 'error'); }
  };
  const exportTopic = async (t) => {
    try { const { topic } = await api.get(`/api/admin/topics/${t.id}`); downloadJson(topic, `${t.title}.json`); } catch (err) { toast(err.message, 'error'); }
  };
  const importFile = async (file) => {
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const { topic } = await api.post('/api/admin/topics/import', { topic: json });
      toast('הנושא יובא כטיוטה', 'success');
      navigate(`/admin/content/${topic.id}`);
    } catch (err) { toast(err.message.includes('JSON') ? 'הקובץ אינו JSON תקין' : err.message, 'error'); }
  };
  const share = (t) => {
    const url = `${window.location.origin}/?topic=${t.id}`;
    navigator.clipboard?.writeText(url);
    toast('קישור ההזמנה לנושא הועתק', 'success');
  };

  return (
    <div className="animate-rise">
      <PageHeader title="נושאים ותכנים" subtitle="כל נושא = הסבר, תרגול, טיפים ומבחנים. שינוי כאן מתעדכן מיד אצל התלמידים." icon={BookOpen} color="bg-st-orange"
        actions={<>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { importFile(e.target.files[0]); e.target.value = ''; }} />
          <Button variant="soft" icon={Upload} onClick={() => fileRef.current.click()}>ייבוא JSON</Button>
          <Button variant="soft" icon={Plus} onClick={() => setNewOpen(true)}>נושא ריק</Button>
          <Button variant="gold" icon={Wand2} onClick={() => navigate('/admin/studio')}>יצירה עם AI</Button>
        </>} />

      {data.topics.length === 0 ? (
        <Card><Empty icon={BookOpen} title="עדיין אין נושאים" action={<Button variant="gold" icon={Wand2} onClick={() => navigate('/admin/studio')}>ליצירת נושא ראשון עם AI</Button>} /></Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([g, list], gi) => (
            <section key={g}>
              <button onClick={() => setCollapsed({ ...collapsed, [g]: !collapsed[g] })} className={cx('flex items-center gap-2 font-black text-lg mb-2 cursor-pointer', GROUP_COLORS[gi % GROUP_COLORS.length])}>
                <ChevronDown size={20} className={cx('transition', collapsed[g] && 'rotate-90')} />{g}<span className="text-sm text-slate-400 font-bold">{list.length} נושאים</span>
              </button>
              {!collapsed[g] && (
                <div className="bg-white rounded-2xl border border-line shadow-[var(--shadow-card)] overflow-x-auto scroll-thin">
                  <table className="w-full text-sm min-w-[980px]">
                    <thead>
                      <tr className="text-slate-500 text-xs border-b border-line">
                        <th className="text-right font-bold p-3 pr-4">נושא</th>
                        <th className="font-bold p-2 w-[120px]">סטטוס</th>
                        <th className="font-bold p-2">הקבצה</th>
                        <th className="font-bold p-2 w-[260px]">תוכן</th>
                        <th className="font-bold p-2">תלמידים עם גישה</th>
                        <th className="font-bold p-2">הצלחה בתרגול</th>
                        <th className="font-bold p-2">עודכן</th>
                        <th className="w-12" />
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((t) => (
                        <tr key={t.id} className={cx('border-b border-line last:border-0 hover:bg-slate-50/80 border-r-[6px]', STRIPES[gi % STRIPES.length])}>
                          <td className="p-3 pr-4">
                            <button onClick={() => navigate(`/admin/content/${t.id}`)} className="text-right cursor-pointer group flex items-center gap-2.5">
                              <span className={cx('w-3 h-9 rounded-full bg-gradient-to-b shrink-0', (TOPIC_COLORS[t.color] || TOPIC_COLORS.sky).bg)} />
                              <span>
                                <span className="font-bold text-navy-900 group-hover:text-[#0073ea] flex items-center gap-1.5"><Rich text={t.title} />{t.aiGenerated && <Sparkles size={13} className="text-st-purple" />}</span>
                                {t.badge && <span className="text-xs text-slate-400">{t.badge}</span>}
                              </span>
                            </button>
                          </td>
                          <td className="p-1.5">
                            <Dropdown align="right" trigger={<StatusPill cell className="rounded-lg" color={t.status === 'published' ? 'green' : 'grey'} onClick={() => {}}>{t.status === 'published' ? 'פורסם' : 'טיוטה'}</StatusPill>}>
                              <button onClick={() => setStatus(t, 'published')} className="w-full p-1 cursor-pointer"><StatusPill cell className="rounded-lg" color="green">פורסם</StatusPill></button>
                              <button onClick={() => setStatus(t, 'draft')} className="w-full p-1 cursor-pointer"><StatusPill cell className="rounded-lg" color="grey">טיוטה</StatusPill></button>
                            </Dropdown>
                          </td>
                          <td className="p-2 text-center text-slate-600">{t.level || '—'}</td>
                          <td className="p-2">
                            <div className="flex flex-wrap gap-1 justify-center text-[11px] font-bold">
                              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">{t.counts.sections} הסברים</span>
                              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md">{t.counts.practice} תרגילים</span>
                              <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md">{t.counts.tips} טיפים</span>
                              <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md">{t.counts.exams} מבחנים</span>
                            </div>
                          </td>
                          <td className="p-2 text-center"><span className="inline-flex items-center gap-1 font-bold"><Users size={14} className="text-slate-400" />{t.accessCount}</span></td>
                          <td className="p-1.5">{t.accuracy === null ? <div className="text-center text-slate-300">—</div> : <StatusPill cell className="rounded-lg" color={t.accuracy >= 75 ? 'green' : t.accuracy >= 55 ? 'orange' : 'red'}>{t.accuracy}%</StatusPill>}</td>
                          <td className="p-2 text-center text-xs text-slate-500">{timeAgo(t.updatedAt)}</td>
                          <td className="p-2">
                            <Dropdown trigger={<button className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center cursor-pointer" aria-label="פעולות"><MoreHorizontal size={18} /></button>}>
                              <DItem icon={Pencil} onClick={() => navigate(`/admin/content/${t.id}`)}>עריכה</DItem>
                              <DItem icon={Eye} onClick={() => navigate(`/topic/${t.id}`)}>תצוגה כתלמיד</DItem>
                              <DItem icon={Share2} onClick={() => share(t)}>העתקת קישור הזמנה</DItem>
                              <a href={waLink('', `היי! פתחתי לכם בלומדה נושא חדש: ${t.title.replace(/\$/g, '')} 🎉\n${window.location.origin}/?topic=${t.id}`)} target="_blank" rel="noreferrer"><DItem icon={Share2}>שיתוף בוואטסאפ</DItem></a>
                              <DItem icon={Copy} onClick={() => duplicate(t)}>שכפול</DItem>
                              <DItem icon={Download} onClick={() => exportTopic(t)}>ייצוא JSON (גיבוי)</DItem>
                              <div className="h-px bg-line my-1" />
                              <DItem icon={Trash2} danger onClick={() => remove(t)}>מחיקה</DItem>
                            </Dropdown>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <Modal open={newOpen} onClose={() => setNewOpen(false)} icon={Plus} title="נושא חדש" subtitle="ייווצר כטיוטה – תוכלי למלא ולפרסם כשמוכן">
        <form onSubmit={create} className="space-y-4">
          <Field label="שם הנושא"><input className="field" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="למשל: משוואות ממעלה ראשונה" required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="כיתה / מסגרת"><select className="field" value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })}><option value="">—</option>{settings.grades.map((g) => <option key={g}>{g}</option>)}</select></Field>
            <Field label="הקבצה"><select className="field" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}><option value="">כל הרמות</option>{settings.levels.map((g) => <option key={g}>{g}</option>)}</select></Field>
          </div>
          <Field label="תיאור קצר"><input className="field" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="צבע"><ColorPicker value={f.color} onChange={(c) => setF({ ...f, color: c })} /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="soft" onClick={() => setNewOpen(false)}>ביטול</Button><Button type="submit">יצירה</Button></div>
        </form>
      </Modal>
    </div>
  );
}

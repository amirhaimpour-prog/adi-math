import { useEffect, useMemo, useState } from 'react';
import { KeyRound, ShieldCheck, UserPlus, Pencil, MessageCircle, Copy, RefreshCw, Layers, BookOpen } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { Button, Field, Modal, StatusPill, Toggle, cx, useUi, waLink } from '../ui/ui.jsx';
import { Rich } from '../lib/Rich.jsx';

export function randomPassword() {
  const words = ['math', 'pi', 'sigma', 'plus', 'star', 'top', 'win', 'go'];
  return words[Math.floor(Math.random() * words.length)] + Math.floor(1000 + Math.random() * 9000);
}

// ------------------------------------------------------------------ access / approval
export function AccessModal({ student, open, onClose, onSaved }) {
  const { settings } = useApp();
  const { toast } = useUi();
  const [topics, setTopics] = useState(null);
  const [grades, setGrades] = useState([]);
  const [topicIds, setTopicIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const pending = student?.status === 'pending';

  useEffect(() => {
    if (!open || !student) return;
    api.get('/api/admin/topics').then((d) => setTopics(d.topics)).catch((e) => toast(e.message, 'error'));
    const a = student.access || { grades: [], topicIds: [] };
    const nothing = !a.grades.length && !a.topicIds.length;
    // Smart defaults for a new student: their grade + the topic they were invited to.
    setGrades(nothing && pending && student.grade && !student.requestedTopic ? [student.grade] : a.grades);
    setTopicIds(nothing && pending && student.requestedTopic ? [student.requestedTopic] : a.topicIds);
  }, [open, student, pending, toast]);

  const byGrade = useMemo(() => {
    const m = new Map();
    for (const t of topics || []) {
      const g = t.grade || 'ללא כיתה';
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(t);
    }
    return [...m.entries()];
  }, [topics]);

  const allGrades = useMemo(() => [...new Set([...settings.grades, ...(topics || []).map((t) => t.grade).filter(Boolean)])], [settings.grades, topics]);

  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = async (approve) => {
    setSaving(true);
    try {
      await api.put(`/api/admin/students/${student.id}/access`, { grades, topicIds, approve });
      toast(approve ? `${student.name} אושר/ה ויכול/ה להתחיל ללמוד! 🎉` : 'ההרשאות עודכנו', 'success');
      onSaved?.();
      onClose();
    } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  };

  const welcome = `היי ${student?.name?.split(' ')[0] || ''}! 🎉 אישרתי לך גישה ללומדה של "עדי - בית למתמטיקה". נכנסים כאן: ${window.location.origin} בהצלחה!`;

  return (
    <Modal open={open} onClose={onClose} size="lg" icon={ShieldCheck}
      title={pending ? `אישור תלמיד/ה: ${student?.name}` : `הרשאות גישה – ${student?.name}`}
      subtitle={`${student?.grade || ''} ${student?.level ? '· ' + student.level : ''} ${student?.program ? '· ' + student.program : ''}`}
      footer={<>
        {student?.phone && <a href={waLink(student.phone, welcome)} target="_blank" rel="noreferrer" className="ml-auto"><Button variant="soft" icon={MessageCircle} className="!text-emerald-700">הודעת ברוכים הבאים</Button></a>}
        <Button variant="soft" onClick={onClose}>ביטול</Button>
        {pending ? <Button variant="green" loading={saving} icon={ShieldCheck} onClick={() => save(true)}>אישור ופתיחת גישה</Button>
          : <Button loading={saving} onClick={() => save(false)}>שמירת הרשאות</Button>}
      </>}>
      {student?.requestedTopicTitle && (
        <div className="mb-4 bg-gold-200/50 border border-gold-300 rounded-xl p-3 text-sm">
          התלמיד/ה נרשם/ה דרך קישור לנושא: <b><Rich text={student.requestedTopicTitle} /></b>
        </div>
      )}
      <section>
        <h4 className="font-black flex items-center gap-2"><Layers size={18} className="text-st-blue" /> גישה לשכבה מלאה</h4>
        <p className="text-xs text-slate-500 mb-3">התלמיד/ה יראו את כל הנושאים שפורסמו לשכבה – כולל נושאים שתוסיפי בעתיד. מתאים לתלמידים שנתיים.</p>
        <div className="flex flex-wrap gap-2">
          {allGrades.map((g) => {
            const on = grades.includes(g);
            const n = (topics || []).filter((t) => t.grade === g && t.status === 'published').length;
            return (
              <button key={g} type="button" onClick={() => toggle(grades, setGrades, g)}
                className={cx('btn-press h-10 px-4 rounded-xl border-2 font-bold text-sm cursor-pointer', on ? 'bg-st-blue border-st-blue text-white' : 'bg-white border-line hover:border-slate-300')}>
                {g} <span className={cx('text-xs', on ? 'text-white/80' : 'text-slate-400')}>({n})</span>
              </button>
            );
          })}
        </div>
      </section>
      <section className="mt-6">
        <h4 className="font-black flex items-center gap-2"><BookOpen size={18} className="text-st-orange" /> נושאים ספציפיים</h4>
        <p className="text-xs text-slate-500 mb-3">למשל: תלמיד שנרשם רק למרתון. נושא בטיוטה ייפתח לתלמיד רק אחרי שתפרסמי אותו.</p>
        {!topics ? <p className="text-sm text-slate-400">טוען...</p> : (
          <div className="space-y-4">
            {byGrade.map(([g, list]) => (
              <div key={g}>
                <div className="text-xs font-black text-slate-500 mb-1.5">{g}{grades.includes(g) && <span className="text-st-blue"> · פתוח לכל השכבה</span>}</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {list.map((t) => {
                    const viaGrade = grades.includes(t.grade);
                    const on = viaGrade || topicIds.includes(t.id);
                    return (
                      <label key={t.id} className={cx('flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer', on ? 'border-st-green bg-emerald-50/60' : 'border-line bg-white', viaGrade && 'opacity-70 cursor-default')}>
                        <input type="checkbox" className="w-5 h-5 accent-[#00c875]" checked={on} disabled={viaGrade} onChange={() => toggle(topicIds, setTopicIds, t.id)} />
                        <span className="flex-1 font-bold text-sm"><Rich text={t.title} /></span>
                        {t.status === 'draft' && <StatusPill color="grey" className="!h-6 !text-[11px]">טיוטה</StatusPill>}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </Modal>
  );
}

// ------------------------------------------------------------------ create / edit
export function StudentFormModal({ open, onClose, student, onSaved }) {
  const { settings } = useApp();
  const { toast } = useUi();
  const isNew = !student;
  const [f, setF] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF(student
      ? { name: student.name, email: student.email, phone: student.phone, grade: student.grade, level: student.level, program: student.program, notes: student.notes || '' }
      : { name: '', email: '', phone: '', grade: '', level: '', program: '', password: randomPassword(), grantGrade: true });
  }, [open, student]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target ? e.target.value : e });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) await api.post('/api/admin/students', f);
      else await api.patch(`/api/admin/students/${student.id}`, f);
      toast(isNew ? 'התלמיד/ה נוספ/ה ואושר/ה' : 'הפרטים נשמרו', 'success');
      onSaved?.();
      onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} icon={isNew ? UserPlus : Pencil} title={isNew ? 'הוספת תלמיד/ה' : `עריכת ${student?.name}`}
      subtitle={isNew ? 'תלמיד/ה שנוספ/ה ידנית מאושר/ת אוטומטית' : undefined}>
      <form onSubmit={save} className="space-y-3.5">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="שם מלא"><input className="field" value={f.name || ''} onChange={set('name')} required /></Field>
          <Field label="טלפון"><input className="field" dir="ltr" value={f.phone || ''} onChange={set('phone')} /></Field>
        </div>
        <Field label="אימייל (משמש להתחברות)"><input className="field" dir="ltr" type="email" value={f.email || ''} onChange={set('email')} required /></Field>
        <div className="grid grid-cols-3 gap-2.5">
          <Field label="כיתה"><select className="field !px-2" value={f.grade || ''} onChange={set('grade')}><option value="">—</option>{settings.grades.map((g) => <option key={g}>{g}</option>)}</select></Field>
          <Field label="הקבצה"><select className="field !px-2" value={f.level || ''} onChange={set('level')}><option value="">—</option>{settings.levels.map((g) => <option key={g}>{g}</option>)}</select></Field>
          <Field label="מסגרת"><select className="field !px-2" value={f.program || ''} onChange={set('program')}><option value="">—</option>{settings.programs.map((g) => <option key={g}>{g}</option>)}</select></Field>
        </div>
        {isNew ? (
          <>
            <Field label="סיסמה ראשונית" hint="שלחי אותה לתלמיד/ה. אפשר לשנות אחר כך.">
              <div className="flex gap-2"><input className="field" dir="ltr" value={f.password || ''} onChange={set('password')} required />
                <Button type="button" variant="soft" icon={RefreshCw} onClick={() => setF({ ...f, password: randomPassword() })} /></div>
            </Field>
            <Toggle checked={!!f.grantGrade} onChange={(v) => setF({ ...f, grantGrade: v })} label="לפתוח גישה לכל נושאי הכיתה שנבחרה" />
          </>
        ) : (
          <Field label="הערות פרטיות (רק את רואה)"><textarea className="field" rows={3} value={f.notes || ''} onChange={set('notes')} placeholder="למשל: מבחן ב-12/12, מתקשה בשברים..." /></Field>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="soft" onClick={onClose}>ביטול</Button>
          <Button type="submit" loading={saving}>{isNew ? 'הוספה' : 'שמירה'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------------ reset password
export function ResetPasswordModal({ open, onClose, student }) {
  const { toast } = useUi();
  const [pw, setPw] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => { if (open) { setPw(randomPassword()); setDone(false); } }, [open]);

  const save = async () => {
    try {
      await api.post(`/api/admin/students/${student.id}/reset-password`, { password: pw });
      setDone(true);
      toast('הסיסמה אופסה', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };
  const msg = `היי ${student?.name?.split(' ')[0] || ''}, הסיסמה החדשה שלך ללומדה: ${pw}\nכניסה: ${window.location.origin}`;

  return (
    <Modal open={open} onClose={onClose} icon={KeyRound} title={`איפוס סיסמה – ${student?.name}`} size="sm">
      <Field label="סיסמה חדשה"><input className="field text-center !text-lg !font-black" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} disabled={done} /></Field>
      {!done ? (
        <Button className="w-full mt-4" onClick={save}>איפוס סיסמה</Button>
      ) : (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-emerald-700 font-bold">הסיסמה עודכנה והתלמיד/ה נותק/ה מכל המכשירים.</p>
          <div className="flex gap-2">
            <Button variant="soft" icon={Copy} className="flex-1" onClick={() => { navigator.clipboard?.writeText(msg); toast('הועתק', 'success'); }}>העתקה</Button>
            {student?.phone && <a className="flex-1" href={waLink(student.phone, msg)} target="_blank" rel="noreferrer"><Button variant="green" icon={MessageCircle} className="w-full">שליחה בוואטסאפ</Button></a>}
          </div>
        </div>
      )}
    </Modal>
  );
}

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, MessageCircle, Pencil, ShieldCheck, KeyRound, Flame, Target, Trophy, AlertTriangle, Activity, StickyNote } from 'lucide-react';
import { Button, Card, Empty, PageLoader, ProgressBar, StatusPill, cx, fmtDate, scoreColor, timeAgo, waLink, Chip } from '../ui/ui.jsx';
import { Rich } from '../lib/Rich.jsx';
import { useFetch } from './AdminApp.jsx';
import { STUDENT_STATUS } from './Students.jsx';
import { AccessModal, StudentFormModal, ResetPasswordModal } from './StudentModals.jsx';

export default function StudentDetail({ onChange }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, error, reload } = useFetch(`/api/admin/students/${id}`);
  const { data: list, reload: reloadList } = useFetch('/api/admin/students');
  const [modal, setModal] = useState(null);

  if (error) return <Card><Empty title="לא נמצא" action={<Button onClick={() => navigate('/admin/students')}>חזרה</Button>}>{error}</Empty></Card>;
  if (!data) return <PageLoader />;
  const s = data.student;
  const full = list?.students.find((x) => x.id === s.id);
  const refresh = () => { reload(); reloadList(); onChange?.(); };
  const maxXp = Math.max(20, ...data.days.map((d) => d.xp));
  const weak = data.bySubtopic.filter((x) => x.attempts >= 3).sort((a, b) => a.accuracy - b.accuracy);

  return (
    <div className="space-y-5 animate-rise">
      <button onClick={() => navigate('/admin/students')} className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-navy-900 cursor-pointer"><ArrowRight size={16} /> כל התלמידים</button>
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-200 to-gold-400 flex items-center justify-center text-3xl">{s.avatar || s.name.slice(0, 1)}</div>
          <div className="flex-1 min-w-48">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black">{s.name}</h1>
              <StatusPill color={STUDENT_STATUS[s.status].color}>{STUDENT_STATUS[s.status].label}</StatusPill>
            </div>
            <div className="text-sm text-slate-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <span>{s.grade} {s.level && `· ${s.level}`} {s.program && `· ${s.program}`}</span>
              <span dir="ltr">{s.phone}</span><span dir="ltr">{s.email}</span>
              <span>נרשם/ה {fmtDate(s.createdAt)}</span><span>נראה/תה {timeAgo(s.lastSeen)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {s.phone && <a href={waLink(s.phone, `היי ${s.name.split(' ')[0]}, `)} target="_blank" rel="noreferrer"><Button variant="green" icon={MessageCircle}>וואטסאפ</Button></a>}
            <Button variant="soft" icon={ShieldCheck} disabled={!full} onClick={() => setModal('access')}>הרשאות</Button>
            <Button variant="soft" icon={Pencil} onClick={() => setModal('form')}>עריכה</Button>
            <Button variant="soft" icon={KeyRound} onClick={() => setModal('reset')}>סיסמה</Button>
          </div>
        </div>
        {s.notes && <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm flex gap-2"><StickyNote size={16} className="text-amber-600 shrink-0 mt-0.5" />{s.notes}</div>}
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="XP כולל" value={s.xp} sub={`${s.levelInfo.emoji} רמה ${s.levelInfo.level}`} color="bg-gold-500" icon={Trophy} />
        <Kpi label="רצף ימים" value={s.streak} sub={`שיא: ${s.bestStreak}`} color="bg-st-orange" icon={Flame} />
        <Kpi label="תשובות" value={data.stats.answers} sub={`${data.stats.weekAnswers} השבוע`} color="bg-st-blue" icon={Activity} />
        <Kpi label="דיוק" value={data.stats.accuracy === null ? '—' : `${data.stats.accuracy}%`} color="bg-st-green" icon={Target} />
        <Kpi label="ממוצע מבחנים" value={data.stats.examAvg ?? '—'} sub={`${data.stats.exams} מבחנים`} color="bg-st-purple" icon={Trophy} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="font-black flex items-center gap-2 mb-1"><AlertTriangle size={19} className="text-st-red" /> לאן כדאי לכוון בשיעור הבא</h3>
          <p className="text-xs text-slate-500 mb-3">דיוק לפי תת-נושא (לפחות 3 ניסיונות)</p>
          {weak.length === 0 ? <p className="text-sm text-slate-400">אין עדיין מספיק נתונים.</p> : (
            <div className="space-y-2.5">
              {weak.slice(0, 10).map((w) => (
                <div key={w.topicId + w.subtopic}>
                  <div className="flex justify-between text-sm mb-1"><span className="font-bold">{w.subtopic} <span className="text-slate-400 font-normal text-xs">· <Rich text={w.topicTitle} /></span></span><span className="font-black">{w.accuracy}% <span className="text-slate-400 font-normal text-xs">({w.attempts})</span></span></div>
                  <ProgressBar value={w.accuracy / 100} color={w.accuracy >= 75 ? 'bg-st-green' : w.accuracy >= 55 ? 'bg-st-orange' : 'bg-st-red'} />
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="font-black mb-3">פעילות ב-28 הימים האחרונים</h3>
          <div className="flex items-end gap-1 h-36">
            {data.days.map((d) => (
              <div key={d.day} title={`${d.day}: ${d.xp} XP, ${d.answers} תשובות`} className="flex-1 h-full flex items-end">
                <div className={cx('w-full rounded-t-md', d.xp ? 'bg-st-blue' : 'bg-slate-100')} style={{ height: `${Math.max(4, (d.xp / maxXp) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 mt-1"><span>לפני 4 שבועות</span><span>היום</span></div>
          <div className="mt-4">
            <h4 className="text-sm font-black mb-2">תגים</h4>
            <div className="flex flex-wrap gap-1.5">{data.badges.length ? data.badges.map((b) => <Chip key={b.id} color="gold">{b.emoji} {b.name}</Chip>) : <span className="text-sm text-slate-400">עדיין אין</span>}</div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="font-black mb-3">התקדמות בנושאים</h3>
          {data.progress.length === 0 ? <p className="text-sm text-slate-400">עוד לא התחיל/ה לתרגל.</p> : data.progress.map((p) => (
            <div key={p.topicId} className="py-2.5 border-b border-line last:border-0">
              <div className="flex justify-between text-sm mb-1"><span className="font-bold"><Rich text={p.title} /></span><span className="text-slate-500">{p.solved}/{p.total} {p.bestExam !== null && `· מבחן: ${p.bestExam}`}</span></div>
              <ProgressBar value={p.total ? p.solved / p.total : 0} />
            </div>
          ))}
        </Card>
        <Card className="p-5">
          <h3 className="font-black mb-3">מבחנים</h3>
          {data.exams.length === 0 ? <p className="text-sm text-slate-400">עוד לא נבחנ/ה.</p> : (
            <table className="w-full text-sm">
              <tbody>
                {data.exams.map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-0">
                    <td className="py-2"><div className="font-bold"><Rich text={e.exam_title} /></div><div className="text-xs text-slate-400"><Rich text={e.topicTitle} /> · {fmtDate(e.ts)}</div></td>
                    <td className="py-2 text-xs text-slate-500 text-center">{e.correct}/{e.total}<br />{Math.round(e.duration_sec / 60)} דק׳</td>
                    <td className="py-2 w-16"><StatusPill color={scoreColor(e.score)}>{e.score}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {full && <AccessModal open={modal === 'access'} student={full} onClose={() => setModal(null)} onSaved={refresh} />}
      <StudentFormModal open={modal === 'form'} student={{ ...s, notes: s.notes }} onClose={() => setModal(null)} onSaved={refresh} />
      <ResetPasswordModal open={modal === 'reset'} student={s} onClose={() => setModal(null)} />
    </div>
  );
}

export function Kpi({ label, value, sub, color, icon: Icon }) {
  return (
    <Card className="p-4 relative overflow-hidden">
      <div className={cx('absolute top-0 right-0 left-0 h-1', color)} />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-bold text-slate-500">{label}</div>
          <div className="text-2xl sm:text-3xl font-black mt-1">{value}</div>
          {sub && <div className="text-xs text-slate-400 font-semibold mt-0.5">{sub}</div>}
        </div>
        {Icon && <div className={cx('w-9 h-9 rounded-xl text-white flex items-center justify-center', color)}><Icon size={18} /></div>}
      </div>
    </Card>
  );
}

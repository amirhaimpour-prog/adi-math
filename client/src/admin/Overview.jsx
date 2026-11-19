import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, UserCheck, Activity, Trophy, BookOpen, Wand2, AlertTriangle, MessageCircle, Moon, ShieldCheck, Copy, Sparkles } from 'lucide-react';
import { useApp } from '../App.jsx';
import { Button, Card, PageLoader, StatusPill, cx, fmtDate, scoreColor, timeAgo, useUi, waLink } from '../ui/ui.jsx';
import { Rich } from '../lib/Rich.jsx';
import { PageHeader, useFetch } from './AdminApp.jsx';
import { Kpi } from './StudentDetail.jsx';
import { AccessModal } from './StudentModals.jsx';

export default function Overview({ onChange }) {
  const { user } = useApp();
  const { toast } = useUi();
  const navigate = useNavigate();
  const { data, reload } = useFetch('/api/admin/overview');
  const { data: students, reload: reloadStudents } = useFetch('/api/admin/students');
  const [approve, setApprove] = useState(null);

  if (!data) return <PageLoader />;
  const k = data.kpis;
  const maxA = Math.max(10, ...data.days.map((d) => d.answers));
  const link = window.location.origin;
  const dayNames = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

  return (
    <div className="space-y-6 animate-rise">
      <PageHeader title={`שלום ${user.name.split(' ')[0]} 👋`} subtitle="זה מה שקורה בלומדה שלך" icon={LayoutDashboard} color="bg-st-blue"
        actions={<>
          <Button variant="soft" icon={Copy} onClick={() => { navigator.clipboard?.writeText(link); toast('הקישור למערכת הועתק – שלחי אותו לתלמידים', 'success'); }}>העתקת קישור לתלמידים</Button>
          <Button variant="gold" icon={Wand2} onClick={() => navigate('/admin/studio')}>יצירת נושא עם AI</Button>
        </>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="תלמידים פעילים" value={k.students} sub={`${k.activeWeek} תרגלו השבוע`} color="bg-st-green" icon={Users} />
        <Kpi label="ממתינים לאישור" value={k.pending} color={k.pending ? 'bg-st-orange' : 'bg-st-grey'} icon={UserCheck} />
        <Kpi label="תשובות השבוע" value={k.answersWeek} color="bg-st-blue" icon={Activity} />
        <Kpi label="ממוצע מבחנים" value={k.examAvg ?? '—'} sub={`${k.examsMonth} מבחנים ב-30 יום`} color="bg-st-purple" icon={Trophy} />
      </div>

      {data.pending.length > 0 && (
        <Card className="p-5 border-2 !border-st-orange/40">
          <h3 className="font-black flex items-center gap-2 text-lg"><span className="w-2.5 h-2.5 rounded-full bg-st-orange animate-pulse" /> נרשמו ומחכים לך ({data.pending.length})</h3>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-3">
            {data.pending.map((p) => (
              <div key={p.id} className="flex items-center gap-3 bg-amber-50/60 border border-amber-100 rounded-2xl p-3">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center font-black text-navy-700">{p.name.slice(0, 1)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{p.name}</div>
                  <div className="text-xs text-slate-500 truncate">{[p.grade, p.level, p.program].filter(Boolean).join(' · ')} · {timeAgo(p.createdAt)}</div>
                </div>
                <Button size="sm" variant="green" icon={ShieldCheck} disabled={!students}
                  onClick={() => setApprove(students?.students.find((s) => s.id === p.id))}>אישור</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid xl:grid-cols-[1.4fr_1fr] gap-5">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-black">פעילות התלמידים – 14 ימים</h3>
            <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-st-blue" />תשובות</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gold-500" />תלמידים פעילים</span>
            </div>
          </div>
          <div className="flex items-end gap-1.5 sm:gap-2 h-48 mt-5">
            {data.days.map((d) => (
              <div key={d.day} className="flex-1 h-full flex flex-col items-center justify-end gap-1" title={`${d.day}: ${d.answers} תשובות, ${d.active} תלמידים`}>
                {d.active > 0 && <span className="text-[10px] font-black text-white bg-gold-500 rounded-full w-5 h-5 flex items-center justify-center">{d.active}</span>}
                <div className={cx('w-full rounded-t-lg transition-all duration-700', d.answers ? 'bg-gradient-to-t from-[#0073ea] to-st-blue' : 'bg-slate-100')} style={{ height: `${Math.max(3, (d.answers / maxA) * 80)}%` }} />
                <span className="text-[10px] text-slate-400 font-bold">{dayNames[new Date(d.day + 'T12:00:00').getDay()]}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-black flex items-center gap-2"><AlertTriangle size={19} className="text-st-red" /> נורות אזהרה לפני השיעור</h3>
          <p className="text-xs text-slate-500">תלמידים עם פחות מ-60% הצלחה בתת-נושא</p>
          {data.attention.length === 0 ? (
            <div className="text-sm text-slate-400 mt-6 text-center">אין כרגע התראות 🎉</div>
          ) : (
            <ul className="mt-3 space-y-2 max-h-64 overflow-y-auto scroll-thin">
              {data.attention.map((a, i) => (
                <li key={i}>
                  <button onClick={() => navigate(`/admin/students/${a.studentId}`)} className="w-full text-right flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer">
                    <StatusPill color={a.accuracy < 40 ? 'red' : 'orange'} className="!w-14 shrink-0">{a.accuracy}%</StatusPill>
                    <span className="flex-1 min-w-0 text-sm"><b>{a.name}</b> מתקשה ב<b>{a.subtopic}</b><span className="block text-xs text-slate-400 truncate"><Rich text={a.topicTitle} /> · {a.attempts} ניסיונות</span></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="font-black flex items-center gap-2"><Trophy size={19} className="text-st-purple" /> מבחנים אחרונים</h3>
          {data.recentExams.length === 0 ? <p className="text-sm text-slate-400 mt-4">עוד לא הוגשו מבחנים.</p> : (
            <div className="mt-3 divide-y divide-line">
              {data.recentExams.map((r) => (
                <button key={r.id} onClick={() => navigate(`/admin/students/${r.user_id}`)} className="w-full flex items-center gap-3 py-2.5 text-right cursor-pointer hover:bg-slate-50 rounded-lg px-1">
                  <span className="flex-1 min-w-0"><b className="text-sm">{r.name}</b><span className="block text-xs text-slate-400 truncate"><Rich text={r.exam_title} /> · {fmtDate(r.ts)}</span></span>
                  <StatusPill color={scoreColor(r.score)} className="!w-14">{r.score}</StatusPill>
                </button>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="font-black flex items-center gap-2"><Moon size={19} className="text-slate-500" /> לא נכנסו כבר שבוע</h3>
          {data.inactive.length === 0 ? <p className="text-sm text-slate-400 mt-4">כולם פעילים! 💪</p> : (
            <div className="mt-3 divide-y divide-line">
              {data.inactive.map((s) => (
                <div key={s.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex-1 text-sm"><b>{s.name}</b><span className="text-xs text-slate-400 mr-2">{s.lastActiveDay ? `פעילות אחרונה: ${s.lastActiveDay.split('-').reverse().join('/')}` : 'עוד לא התחיל/ה'}</span></span>
                  {s.phone && <a href={waLink(s.phone, `היי ${s.name.split(' ')[0]}! לא ראיתי אותך בלומדה כבר כמה ימים 😊 יש לך 10 דקות לתרגל היום? ${link}`)} target="_blank" rel="noreferrer">
                    <Button size="xs" variant="soft" icon={MessageCircle} className="!text-emerald-700">תזכורת</Button></a>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <QuickCard icon={BookOpen} color="bg-st-orange" title={`${k.topics} נושאים פעילים`} text={k.drafts ? `${k.drafts} טיוטות מחכות לפרסום` : 'כל הנושאים פורסמו'} onClick={() => navigate('/admin/content')} />
        <QuickCard icon={Sparkles} color="bg-st-purple" title="נושא חדש תוך דקות" text="העלי PDF / תמונה / קישור – ה-AI יבנה לומדה" onClick={() => navigate('/admin/studio')} />
        <QuickCard icon={Users} color="bg-st-green" title="ניהול תלמידים" text="הרשאות, סיסמאות והתקדמות" onClick={() => navigate('/admin/students')} />
      </div>

      <AccessModal open={!!approve} student={approve} onClose={() => setApprove(null)} onSaved={() => { reload(); reloadStudents(); onChange?.(); }} />
    </div>
  );
}

function QuickCard({ icon: Icon, color, title, text, onClick }) {
  return (
    <button onClick={onClick} className="text-right bg-white rounded-2xl border border-line shadow-[var(--shadow-card)] p-4 flex items-center gap-3 hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)] transition cursor-pointer">
      <div className={cx('w-11 h-11 rounded-2xl text-white flex items-center justify-center shrink-0', color)}><Icon size={22} /></div>
      <div><div className="font-black">{title}</div><div className="text-xs text-slate-500">{text}</div></div>
    </button>
  );
}

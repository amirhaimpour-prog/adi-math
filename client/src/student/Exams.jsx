import { useEffect, useRef, useState } from 'react';
import { GraduationCap, Timer, Play, ArrowRight, ArrowLeft, Send, Trophy, RotateCcw, CheckCircle2, XCircle, ListChecks, Clock } from 'lucide-react';
import { api } from '../lib/api.js';
import { useGame } from './StudentShell.jsx';
import { Button, Card, Chip, Empty, Ring, StatusPill, cx, fmtDate, scoreColor, useUi } from '../ui/ui.jsx';
import { Rich } from '../lib/Rich.jsx';
import { sfx, bigCelebration, burst } from '../lib/fx.js';
import { QuestionInput, initialResponse, isAnswered } from './QuestionInputs.jsx';

function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function Exams({ topic, results, onDone }) {
  const [running, setRunning] = useState(null); // {sessionId, exam, deadline, offset}
  const [result, setResult] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const { toast } = useUi();

  const start = async (exam) => {
    setLoadingId(exam.id);
    try {
      const d = await api.post(`/api/topics/${topic.id}/exams/${exam.id}/start`);
      sfx.click();
      setResult(null);
      setRunning({ ...d, offset: Date.now() - d.serverNow });
    } catch (e) { toast(e.message, 'error'); } finally { setLoadingId(null); }
  };

  if (running) {
    return <ExamRunner session={running} onFinish={(r) => { setRunning(null); setResult(r); onDone(); }} onExit={() => setRunning(null)} />;
  }
  if (result) return <ExamResult result={result} onBack={() => setResult(null)} onRetake={() => start(result.exam)} />;

  if (!topic.exams.length) return <Card><Empty icon={GraduationCap} title="עדיין אין מבחנים בנושא הזה" /></Card>;

  const best = {};
  const count = {};
  for (const r of results) {
    best[r.exam_id] = Math.max(best[r.exam_id] ?? 0, r.score);
    count[r.exam_id] = (count[r.exam_id] || 0) + 1;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-purple-50 border border-purple-100 p-4 text-sm text-purple-900 flex items-start gap-3">
        <ListChecks className="shrink-0 mt-0.5" size={20} />
        <div><b>איך זה עובד?</b> במבחן אין רמזים ואין בדיקה אחרי כל שאלה – בדיוק כמו בכיתה. בסוף מגישים, מקבלים ציון ופירוט מלא של כל שאלה.</div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {topic.exams.map((e, i) => {
          const b = best[e.id];
          return (
            <Card key={e.id} className="p-5 flex flex-col animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-st-purple text-white flex items-center justify-center shrink-0"><GraduationCap size={24} /></div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-lg leading-snug"><Rich text={e.title} /></h3>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {e.levelBadge && <Chip color="purple">{e.levelBadge}</Chip>}
                    <Chip>{e.questionCount} שאלות</Chip>
                    {e.timeLimitMin > 0 && <Chip color="red"><Clock size={12} /> {e.timeLimitMin} דק׳</Chip>}
                  </div>
                </div>
                {b !== undefined && (
                  <Ring value={b / 100} size={58} stroke={6} color={b >= 85 ? '#00C875' : b >= 65 ? '#FDAB3D' : '#E2445C'}>
                    <span className="text-sm font-black">{b}</span>
                  </Ring>
                )}
              </div>
              {e.description && <p className="text-sm text-slate-600 mt-3 leading-relaxed flex-1"><Rich text={e.description} /></p>}
              <div className="flex items-center justify-between mt-4 gap-2">
                <span className="text-xs text-slate-500 font-bold">{count[e.id] ? `נבחנת ${count[e.id]} פעמים · שיא: ${b}` : 'עוד לא נבחנת'}</span>
                <Button variant={count[e.id] ? 'soft' : 'primary'} icon={count[e.id] ? RotateCcw : Play} loading={loadingId === e.id} onClick={() => start(e)}>
                  {count[e.id] ? 'מבחן חוזר' : 'התחלת מבחן'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      {results.length > 0 && (
        <Card className="p-5">
          <h3 className="font-black mb-3">היסטוריית מבחנים</h3>
          <div className="divide-y divide-line">
            {results.slice(0, 10).map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-semibold"><Rich text={topic.exams.find((e) => e.id === r.exam_id)?.title || 'מבחן'} /></span>
                <span className="flex items-center gap-3"><span className="text-slate-400 text-xs">{fmtDate(r.ts)}</span><StatusPill color={scoreColor(r.score)}>{r.score}</StatusPill></span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ExamRunner({ session, onFinish, onExit }) {
  const { exam } = session;
  const { celebrate } = useGame();
  const { toast, confirm } = useUi();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState(() => Object.fromEntries(exam.questions.map((q) => [q.id, initialResponse(q)])));
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [left, setLeft] = useState(session.deadline ? (session.deadline - (Date.now() - session.offset)) / 1000 : null);
  const submittedRef = useRef(false);
  const rootRef = useRef(null);
  useEffect(() => { rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [idx]);

  const q = exam.questions[idx];
  const answeredCount = exam.questions.filter((x) => touched[x.id] && isAnswered(x, answers[x.id])).length;

  const submit = async (force = false) => {
    if (submittedRef.current) return;
    if (!force && answeredCount < exam.questions.length) {
      const ok = await confirm({ title: 'להגיש את המבחן?', message: `ענית על ${answeredCount} מתוך ${exam.questions.length} שאלות. שאלות שלא נענו ייחשבו כשגויות.`, confirmText: 'הגשה' });
      if (!ok) return;
    }
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const payload = {};
      for (const x of exam.questions) if (touched[x.id]) payload[x.id] = answers[x.id];
      const r = await api.post(`/api/exam-sessions/${session.sessionId}/submit`, { answers: payload });
      if (r.game) celebrate(r.game);
      if (r.score >= 85) bigCelebration(); else if (r.score >= 65) burst();
      sfx[r.score >= 65 ? 'levelUp' : 'click']();
      onFinish({ ...r, exam });
    } catch (e) {
      submittedRef.current = false;
      toast(e.message, 'error');
    } finally { setSubmitting(false); }
  };

  useEffect(() => {
    if (!session.deadline) return undefined;
    const t = setInterval(() => {
      const l = (session.deadline - (Date.now() - session.offset)) / 1000;
      setLeft(l);
      if (l <= 0) { clearInterval(t); toast('הזמן נגמר! המבחן מוגש אוטומטית.', 'warning'); submit(true); }
    }, 500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    const warn = (e) => { if (!submittedRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const setAnswer = (v) => { setAnswers((a) => ({ ...a, [q.id]: v })); setTouched((t) => ({ ...t, [q.id]: true })); };

  const exit = async () => {
    if (await confirm({ title: 'לצאת מהמבחן?', message: 'התשובות שלך לא יישמרו.', confirmText: 'יציאה', danger: true })) onExit();
  };

  return (
    <div ref={rootRef} className="grid lg:grid-cols-[1fr_270px] gap-5 items-start animate-pop scroll-mt-36">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3 bg-navy-900 text-white">
          <div className="min-w-0">
            <div className="text-xs text-gold-300 font-bold">מבחן</div>
            <div className="font-black truncate"><Rich text={exam.title} /></div>
          </div>
          {left !== null && (
            <div className={cx('flex items-center gap-1.5 px-3 h-10 rounded-xl font-black text-lg tabular-nums', left < 60 ? 'bg-st-red animate-pulse' : 'bg-white/15')}>
              <Timer size={20} />{fmtTime(left)}
            </div>
          )}
        </div>
        <div className="h-1.5 bg-slate-100"><div className="h-full bg-st-purple transition-all" style={{ width: `${((idx + 1) / exam.questions.length) * 100}%` }} /></div>
        <div className="p-5 sm:p-7 space-y-6" key={q.id}>
          <div className="text-sm font-black text-st-purple">שאלה {idx + 1} מתוך {exam.questions.length}</div>
          <div className="text-xl sm:text-2xl font-bold leading-relaxed animate-pop"><Rich text={q.prompt} /></div>
          {q.imageUrl && <img src={q.imageUrl} alt="" className="rounded-2xl border border-line max-h-80 object-contain" />}
          <QuestionInput q={q} value={answers[q.id]} onChange={setAnswer} onEnter={() => idx < exam.questions.length - 1 && setIdx(idx + 1)} />
          <div className="flex items-center justify-between gap-2 pt-2">
            <Button variant="soft" icon={ArrowRight} disabled={idx === 0} onClick={() => setIdx(idx - 1)}>הקודמת</Button>
            {idx < exam.questions.length - 1 ? (
              <Button variant="primary" onClick={() => setIdx(idx + 1)}>הבאה <ArrowLeft size={18} /></Button>
            ) : (
              <Button variant="gold" icon={Send} loading={submitting} onClick={() => submit(false)}>הגשת המבחן</Button>
            )}
          </div>
        </div>
      </Card>
      <aside className="space-y-3 lg:sticky lg:top-36">
        <Card className="p-4">
          <div className="flex justify-between text-sm font-bold mb-3"><span>ניווט בין שאלות</span><span className="text-slate-500">{answeredCount}/{exam.questions.length}</span></div>
          <div className="grid grid-cols-5 gap-1.5">
            {exam.questions.map((x, i) => (
              <button key={x.id} onClick={() => setIdx(i)}
                className={cx('btn-press aspect-square rounded-xl text-sm font-black cursor-pointer',
                  i === idx && 'ring-2 ring-navy-900 ring-offset-1',
                  touched[x.id] && isAnswered(x, answers[x.id]) ? 'bg-st-purple text-white' : 'bg-slate-100 text-slate-500')}>
                {i + 1}
              </button>
            ))}
          </div>
          <Button variant="gold" icon={Send} className="w-full mt-4" loading={submitting} onClick={() => submit(false)}>הגשה</Button>
          <Button variant="ghost" size="sm" className="w-full mt-1" onClick={exit}>יציאה ללא הגשה</Button>
        </Card>
      </aside>
    </div>
  );
}

function ExamResult({ result, onBack, onRetake }) {
  const { score, correct, total, details, duration, late } = result;
  const msg = score >= 95 ? 'מושלם! עדי גאה בך 🏆' : score >= 85 ? 'מצוין! את/ה ממש שולט/ת בחומר 🌟' : score >= 70 ? 'יפה מאוד! עוד קצת תרגול וזה 100 💪'
    : score >= 55 ? 'התחלה טובה – כדאי לחזור על ההסברים והטיפים 📚' : 'לא נורא! עברו על הפתרונות, תרגלו ונסו שוב – זה הדרך להצליח 💙';
  const color = score >= 85 ? '#00C875' : score >= 65 ? '#FDAB3D' : '#E2445C';

  const fmtGiven = (d) => {
    if (d.given === null || d.given === undefined || d.given === '') return 'לא נענתה';
    if (d.type === 'truefalse') return d.given === 'true' ? 'נכון' : 'לא נכון';
    if (d.type === 'input' && !String(d.given).includes('$')) return `$${d.given}$`;
    return String(d.given);
  };

  return (
    <div className="space-y-5 animate-pop">
      <Card className="p-6 sm:p-8 text-center relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: color }} />
        <Ring value={score / 100} size={150} stroke={13} color={color}>
          <div><div className="text-5xl font-black">{score}</div><div className="text-xs text-slate-500 font-bold">ציון</div></div>
        </Ring>
        <h2 className="text-2xl font-black mt-4">{msg}</h2>
        <p className="text-slate-500 mt-1 font-semibold">{correct} תשובות נכונות מתוך {total} · {Math.floor(duration / 60)} דק׳ {duration % 60} שנ׳</p>
        {late && <p className="text-rose-600 font-bold mt-1">המבחן הוגש אחרי שהזמן הסתיים.</p>}
        {result.game?.xpGained > 0 && <div className="inline-flex items-center gap-1.5 mt-3 bg-gold-200 text-gold-600 font-black px-3 py-1 rounded-full"><Trophy size={16} /> <span dir="ltr">+{result.game.xpGained} XP</span></div>}
        <div className="flex flex-wrap justify-center gap-2 mt-6">
          <Button variant="soft" icon={ArrowRight} onClick={onBack}>לכל המבחנים</Button>
          <Button variant="primary" icon={RotateCcw} onClick={onRetake}>מבחן חוזר</Button>
        </div>
      </Card>

      <h3 className="text-xl font-black">פירוט התשובות</h3>
      <div className="space-y-3">
        {details.map((d, i) => (
          <Card key={d.id} className={cx('p-5 border-r-4', d.correct ? '!border-r-st-green' : '!border-r-st-red')}>
            <div className="flex items-start gap-3">
              {d.correct ? <CheckCircle2 className="text-st-green shrink-0" size={26} /> : <XCircle className="text-st-red shrink-0" size={26} />}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black text-slate-400">שאלה {i + 1}</div>
                <div className="font-bold text-lg leading-relaxed"><Rich text={d.prompt} /></div>
                <div className="grid sm:grid-cols-2 gap-2 mt-3 text-sm">
                  <div className={cx('rounded-xl p-2.5', d.correct ? 'bg-emerald-50' : 'bg-rose-50')}>
                    <div className="text-xs font-bold text-slate-500">התשובה שלך</div>
                    <div className="font-bold mt-0.5"><Rich text={fmtGiven(d)} /></div>
                  </div>
                  {!d.correct && (
                    <div className="rounded-xl p-2.5 bg-emerald-50">
                      <div className="text-xs font-bold text-slate-500">התשובה הנכונה</div>
                      <div className="font-bold mt-0.5"><Rich text={d.correctAnswer} /></div>
                    </div>
                  )}
                </div>
                {!d.correct && d.explanation && <div className="mt-3 text-slate-700 bg-slate-50 rounded-xl p-3 leading-relaxed"><Rich text={d.explanation} /></div>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

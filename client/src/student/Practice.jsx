import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, CheckCircle2, Lightbulb, XCircle, Flame, MessageCircle, Sparkles, RotateCcw, Shuffle, Trophy, Dumbbell } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { useGame } from './StudentShell.jsx';
import { Button, Card, Chip, Empty, cx, useUi, waLink } from '../ui/ui.jsx';
import { Rich } from '../lib/Rich.jsx';
import { sfx, burst, bigCelebration } from '../lib/fx.js';
import { QuestionInput, initialResponse, isAnswered, TYPE_LABELS } from './QuestionInputs.jsx';

const PRAISE = ['מעולה!', 'כל הכבוד!', 'בול!', 'אלופים!', 'יפה מאוד!', 'וואו, מדויק!', 'תותחים!', 'נכון מאוד!'];
const COMBO_MSG = { 3: 'רצף של 3! 🔥', 5: 'קומבו x5! ⚡', 8: 'בלתי ניתנים לעצירה! 🚀', 10: 'קומבו x10!!! 💥', 15: 'אגדה! 👑' };

export default function Practice({ topic, progress, onSolved }) {
  const { settings, user } = useApp();
  const { celebrate, preview } = useGame();
  const { toast } = useUi();
  const solved = useMemo(() => new Set(progress.solvedIds), [progress.solvedIds]);

  const subtopics = useMemo(() => {
    const m = new Map();
    topic.practiceQuestions.forEach((q) => { const k = q.subtopic || 'כללי'; m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()];
  }, [topic.practiceQuestions]);

  const [filter, setFilter] = useState('all');
  const list = useMemo(() => topic.practiceQuestions.filter((q) => filter === 'all' || (q.subtopic || 'כללי') === filter), [topic.practiceQuestions, filter]);

  const firstUnsolved = useCallback((l) => Math.max(0, l.findIndex((q) => !solved.has(q.id))), [solved]);
  const [idx, setIdx] = useState(() => firstUnsolved(list));
  const [response, setResponse] = useState(null);
  const [attempt, setAttempt] = useState(1);
  const [feedback, setFeedback] = useState(null); // {kind:'correct'|'hint'|'reveal', ...}
  const [checking, setChecking] = useState(false);
  const [combo, setCombo] = useState(0);
  const [session, setSession] = useState({ correct: 0, total: 0 });
  const [wrongPick, setWrongPick] = useState(null);
  const [comboFlash, setComboFlash] = useState('');
  const cardRef = useRef(null);

  const q = list[idx];

  useEffect(() => {
    if (!q) return;
    setResponse(initialResponse(q));
    setAttempt(1);
    setFeedback(null);
    setWrongPick(null);
  }, [q]);

  const changeFilter = (f) => {
    setFilter(f);
    const l = topic.practiceQuestions.filter((x) => f === 'all' || (x.subtopic || 'כללי') === f);
    setIdx(firstUnsolved(l));
  };

  const goTo = (i) => {
    if (i < 0 || i >= list.length) return;
    setIdx(i);
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const next = () => {
    // jump to the next unsolved question after the current one, else just next
    const after = list.findIndex((x, i) => i > idx && !solved.has(x.id) && x.id !== q.id);
    goTo(after >= 0 ? after : Math.min(list.length - 1, idx + 1));
  };

  const randomUnsolved = () => {
    const pool = list.map((x, i) => [x, i]).filter(([x, i]) => !solved.has(x.id) && i !== idx);
    const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)][1] : Math.floor(Math.random() * list.length);
    goTo(pick);
  };

  const check = async () => {
    if (!q || checking || !isAnswered(q, response)) return;
    if (feedback?.kind === 'correct' || feedback?.kind === 'reveal') return next();
    setChecking(true);
    try {
      const r = await api.post(`/api/topics/${topic.id}/practice/${q.id}/check`, { response, attempt, combo });
      setSession((s) => ({ correct: s.correct + (r.correct && attempt === 1 ? 1 : 0), total: attempt === 1 ? s.total + 1 : s.total }));
      if (r.correct) {
        const newCombo = attempt === 1 ? combo + 1 : 0;
        setCombo(newCombo);
        if (COMBO_MSG[newCombo]) { setComboFlash(COMBO_MSG[newCombo]); sfx.combo(); setTimeout(() => setComboFlash(''), 1800); } else sfx.correct();
        if (newCombo >= 5 && newCombo % 5 === 0) burst({ particleCount: 70 });
        setFeedback({ kind: 'correct', praise: PRAISE[Math.floor(Math.random() * PRAISE.length)], explanation: r.explanation, already: r.alreadySolved, xp: r.game?.xpGained || 0 });
        onSolved(q.id);
        if (r.game) {
          celebrate(r.game);
          if (r.game.dailyGoalReached) toast('השלמת את היעד היומי! 🎯', 'success');
        }
        const solvedNow = new Set([...solved, q.id]);
        if (topic.practiceQuestions.every((x) => solvedNow.has(x.id)) && !solved.has(q.id)) setTimeout(() => bigCelebration(), 400);
      } else {
        sfx.wrong();
        setCombo(0);
        if (q.type === 'mcq' || q.type === 'truefalse') setWrongPick(response);
        if (r.correctAnswer) {
          setFeedback({ kind: 'reveal', explanation: r.explanation, correctAnswer: r.correctAnswer, correctValue: r.correctValue });
        } else {
          setFeedback({ kind: 'hint', hint: r.hint });
          setAttempt((a) => a + 1);
        }
      }
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setChecking(false);
    }
  };

  // Enter = check / next
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Enter' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
      check();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!topic.practiceQuestions.length) return <Card><Empty icon={Dumbbell} title="אין עדיין שאלות תרגול בנושא הזה" /></Card>;

  const solvedInList = list.filter((x) => solved.has(x.id)).length;
  const allDone = solvedInList === list.length;
  const done = feedback?.kind === 'correct' || feedback?.kind === 'reveal';
  const sosText = `היי עדי, אני ${user.name} ומתרגל/ת בלומדה בנושא "${topic.title.replace(/\$/g, '')}". נתקעתי בשאלה ${idx + 1}${q?.subtopic ? ` (${q.subtopic})` : ''}:\n${(q?.prompt || '').replace(/\$/g, '')}\nתוכלי לעזור לי? 🙏`;

  return (
    <div className="grid lg:grid-cols-[1fr_290px] gap-5 items-start">
      <div className="space-y-4 min-w-0">
        {/* Subtopic filter */}
        {subtopics.length > 1 && (
          <div className="flex gap-2 overflow-x-auto scroll-thin pb-1">
            <FilterChip active={filter === 'all'} onClick={() => changeFilter('all')}>הכל ({topic.practiceQuestions.length})</FilterChip>
            {subtopics.map(([s, n]) => <FilterChip key={s} active={filter === s} onClick={() => changeFilter(s)}>{s} ({n})</FilterChip>)}
          </div>
        )}

        {allDone && (
          <div className="rounded-2xl bg-gradient-to-l from-emerald-500 to-teal-500 text-white p-4 flex items-center gap-3 shadow-[var(--shadow-card)] animate-pop">
            <Trophy size={30} className="shrink-0" />
            <div className="flex-1"><div className="font-black">פתרת את כל השאלות כאן! 🎉</div><div className="text-sm text-white/90">אפשר לחזור על שאלות לתרגול נוסף, או לנסות מבחן סימולציה.</div></div>
          </div>
        )}

        {q && (
          <Card className="overflow-hidden scroll-mt-36" ref={cardRef}>
            <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-line bg-slate-50/70">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-navy-900">שאלה {idx + 1}<span className="text-slate-400 font-bold">/{list.length}</span></span>
                {q.subtopic && <Chip color="blue">{q.subtopic}</Chip>}
                <Chip>{TYPE_LABELS[q.type]}</Chip>
                {solved.has(q.id) && <Chip color="green"><CheckCircle2 size={12} /> נפתרה</Chip>}
              </div>
              <div className="flex items-center gap-1" title="רמת קושי">
                {[1, 2, 3].map((d) => <span key={d} className={cx('w-2 h-4 rounded-sm', d <= q.difficulty ? 'bg-st-orange' : 'bg-slate-200')} />)}
              </div>
            </div>

            <div className="p-5 sm:p-7 space-y-6" key={q.id}>
              <div className="text-xl sm:text-2xl font-bold leading-relaxed animate-pop"><Rich text={q.prompt} /></div>
              {q.imageUrl && <img src={q.imageUrl} alt="" className="rounded-2xl border border-line max-h-80 object-contain" />}

              <QuestionInput q={q} value={response} onChange={(v) => { setResponse(v); if (feedback?.kind === 'hint') setFeedback({ ...feedback, dim: true }); }}
                disabled={done || checking} onEnter={check}
                status={feedback?.kind === 'correct' ? 'correct' : feedback?.kind === 'reveal' ? 'wrong' : feedback?.kind === 'hint' && !feedback.dim ? 'wrong' : null}
                reveal={q.type === 'mcq' || q.type === 'truefalse' ? {
                  correct: feedback?.kind === 'correct' ? response : null,
                  wrong: (feedback?.kind === 'hint' && !feedback.dim) || feedback?.kind === 'reveal' ? wrongPick : null,
                } : null}
                correctValue={feedback?.correctValue} />

              {feedback?.kind === 'correct' && (
                <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-200 p-4 animate-pop">
                  <div className="flex items-center gap-2 text-emerald-700 font-black text-lg">
                    <CheckCircle2 size={24} /> {feedback.praise}
                    {feedback.xp > 0 && <span dir="ltr" className="mr-auto bg-gold-400 text-navy-950 text-sm px-2.5 py-0.5 rounded-full">+{feedback.xp} XP</span>}
                    {feedback.already && <span className="mr-auto text-xs font-bold text-emerald-600">(כבר נפתרה בעבר)</span>}
                  </div>
                  {feedback.explanation && <details className="mt-2 text-slate-700"><summary className="cursor-pointer font-bold text-sm text-emerald-800">איך פותרים? (הסבר מלא)</summary><div className="mt-2 leading-relaxed"><Rich text={feedback.explanation} /></div></details>}
                </div>
              )}
              {feedback?.kind === 'hint' && (
                <div className="rounded-2xl bg-amber-50 border-2 border-amber-200 p-4 animate-pop">
                  <div className="flex items-center gap-2 text-amber-800 font-black"><Lightbulb size={22} /> כמעט! הנה רמז קטן – נסו שוב:</div>
                  <div className="mt-1.5 text-slate-700 leading-relaxed"><Rich text={feedback.hint} /></div>
                </div>
              )}
              {feedback?.kind === 'reveal' && (
                <div className="rounded-2xl bg-rose-50 border-2 border-rose-200 p-4 animate-pop">
                  <div className="flex items-center gap-2 text-rose-700 font-black"><XCircle size={22} /> לא נורא – ככה לומדים! הנה הפתרון:</div>
                  <div className="mt-2 font-bold">התשובה הנכונה: <span className="bg-white px-2 py-0.5 rounded-lg border border-rose-200"><Rich text={feedback.correctAnswer} /></span></div>
                  {feedback.explanation && <div className="mt-2 text-slate-700 leading-relaxed"><Rich text={feedback.explanation} /></div>}
                  <p className="text-xs text-slate-500 mt-2">טיפ: חזרו לשאלה הזו מאוחר יותר ונסו לפתור אותה לבד.</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button size="lg" variant={done ? 'blue' : 'green'} className="btn-3d min-w-40" loading={checking} disabled={!isAnswered(q, response)} onClick={check}>
                  {done ? (<>לשאלה הבאה <ArrowLeft size={20} /></>) : feedback?.kind === 'hint' ? 'בדיקה שוב' : 'בדיקה'}
                </Button>
                {!done && !preview && (
                  <a href={waLink(settings.whatsappPhone, sosText)} target="_blank" rel="noreferrer">
                    <Button variant="soft" icon={MessageCircle} className="!text-emerald-700">עדי, נתקעתי!</Button>
                  </a>
                )}
                <div className="flex-1" />
                <Button variant="ghost" size="sm" icon={ArrowRight} disabled={idx === 0} onClick={() => goTo(idx - 1)}>הקודמת</Button>
                <Button variant="ghost" size="sm" disabled={idx >= list.length - 1} onClick={() => goTo(idx + 1)}>דלג <ArrowLeft size={16} /></Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Side panel */}
      <aside className="space-y-4 lg:sticky lg:top-36">
        <Card className="p-4 relative overflow-hidden">
          {comboFlash && <div className="absolute inset-0 bg-gradient-to-l from-orange-400 to-amber-300 flex items-center justify-center text-white text-xl font-black animate-bounce-in z-10">{comboFlash}</div>}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-500">רצף הצלחות</div>
              <div className="flex items-center gap-1.5 text-3xl font-black text-orange-500">
                <Flame size={30} className={combo > 0 ? 'fill-orange-400' : 'text-slate-300'} />{combo}
              </div>
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-slate-500">בסשן הזה</div>
              <div className="text-2xl font-black">{session.correct}<span className="text-slate-400 text-base">/{session.total}</span></div>
            </div>
          </div>
          <div className="flex gap-1 mt-3">
            {Array.from({ length: 10 }, (_, i) => <span key={i} className={cx('h-2 flex-1 rounded-full transition-all', i < Math.min(combo, 10) ? 'bg-gradient-to-l from-orange-400 to-amber-300' : 'bg-slate-100')} />)}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">תשובה נכונה בניסיון הראשון = בונוס XP על הרצף!</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-black text-sm">מפת השאלות</span>
            <span className="text-xs font-bold text-slate-500">{solvedInList}/{list.length} נפתרו</span>
          </div>
          <div className="grid grid-cols-8 gap-1.5">
            {list.map((x, i) => (
              <button key={x.id} onClick={() => goTo(i)} title={`שאלה ${i + 1}`}
                className={cx('btn-press aspect-square rounded-lg text-[11px] font-black cursor-pointer',
                  i === idx ? 'ring-2 ring-navy-900 ring-offset-1' : '',
                  solved.has(x.id) ? 'bg-st-green text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}>
                {i + 1}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="soft" icon={Shuffle} className="flex-1" onClick={randomUnsolved}>שאלה אקראית</Button>
            <Button size="sm" variant="soft" icon={RotateCcw} onClick={() => goTo(firstUnsolved(list))} title="לשאלה הראשונה שלא נפתרה" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-navy-900 to-navy-700 text-white border-0">
          <div className="flex items-center gap-2 font-black"><Sparkles size={18} className="text-gold-400" /> איך זה עובד?</div>
          <ul className="text-xs text-white/80 mt-2 space-y-1 leading-relaxed">
            <li>• טעות ראשונה? תקבלו רמז ועוד ניסיון.</li>
            <li>• טעות שנייה? נציג את הפתרון המלא.</li>
            <li>• נכון בניסיון ראשון = 10 XP + בונוס רצף.</li>
          </ul>
        </Card>
      </aside>
    </div>
  );
}

function FilterChip({ active, children, onClick }) {
  return (
    <button onClick={onClick} className={cx('btn-press whitespace-nowrap h-9 px-4 rounded-full text-sm font-bold border cursor-pointer',
      active ? 'bg-navy-900 text-white border-navy-900' : 'bg-white text-slate-600 border-line hover:border-slate-300')}>
      {children}
    </button>
  );
}

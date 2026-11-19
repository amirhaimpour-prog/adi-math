import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useBlocker } from 'react-router-dom';
import {
  ArrowRight, Save, Eye, BookOpen, Dumbbell, Lightbulb, GraduationCap, Settings2, BarChart3, Plus, Wand2, Rocket,
  AlertTriangle, Share2, Loader2, Clock, CheckCircle2,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { Button, Card, Chip, Empty, Field, Modal, PageLoader, StatusPill, Tabs, Toggle, cx, useUi } from '../ui/ui.jsx';
import { Rich } from '../lib/Rich.jsx';
import { TYPE_LABELS } from '../student/QuestionInputs.jsx';
import { ColorPicker } from './Topics.jsx';
import { RichField, StringList, ImageField, ItemCard, QuestionEditor, blankQuestion, move, newId, questionProblems } from './EditorParts.jsx';

export function useJobPoller() {
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return useCallback((jobId, onUpdate) => new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const { job } = await api.get(`/api/admin/ai/jobs/${jobId}`);
        onUpdate?.(job);
        if (job.status === 'done') return resolve(job);
        if (job.status === 'error') return reject(new Error(job.error || 'היצירה נכשלה'));
        timers.current.push(setTimeout(tick, 1800));
      } catch (e) { reject(e); }
    };
    tick();
  }), []);
}

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useApp();
  const { toast, confirm } = useUi();
  const [topic, setTopic] = useState(null);
  const [saved, setSaved] = useState(null);
  const [tab, setTab] = useState('learn');
  const [saving, setSaving] = useState(false);
  const [openItem, setOpenItem] = useState(null);
  const [aiModal, setAiModal] = useState(null); // 'practice' | 'exam'
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { topic: t } = await api.get(`/api/admin/topics/${id}`);
      setTopic(t);
      setSaved(JSON.stringify(t));
    } catch (e) { setError(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const dirty = topic && saved !== JSON.stringify(topic);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    confirm({ title: 'יש שינויים שלא נשמרו', message: 'לצאת בלי לשמור? השינויים יאבדו.', confirmText: 'יציאה בלי שמירה', danger: true })
      .then((ok) => (ok ? blocker.proceed() : blocker.reset()));
  }, [blocker, confirm]);
  useEffect(() => {
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = useCallback(async (patch = {}) => {
    if (!topic) return null;
    setSaving(true);
    try {
      const { topic: t } = await api.put(`/api/admin/topics/${topic.id}`, { topic: { ...topic, ...patch } });
      setTopic(t);
      setSaved(JSON.stringify(t));
      toast(patch.status === 'published' ? 'פורסם! התלמידים כבר רואים את הנושא 🚀' : patch.status === 'draft' ? 'הנושא הוסתר מהתלמידים' : 'נשמר ✓', 'success');
      return t;
    } catch (e) { toast(e.message, 'error'); return null; } finally { setSaving(false); }
  }, [topic, toast]);

  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  const subtopics = useMemo(() => [...new Set((topic?.practiceQuestions || []).map((q) => q.subtopic).filter(Boolean))], [topic]);
  const problems = useMemo(() => {
    if (!topic) return [];
    const out = [];
    topic.practiceQuestions.forEach((q, i) => questionProblems(q).forEach((p) => out.push(`תרגול ${i + 1}: ${p}`)));
    topic.exams.forEach((e, ei) => e.questions.forEach((q, i) => questionProblems(q).forEach((p) => out.push(`מבחן ${ei + 1} שאלה ${i + 1}: ${p}`))));
    return out;
  }, [topic]);

  if (error) return <Card><Empty title="הנושא לא נמצא" action={<Button onClick={() => navigate('/admin/content')}>חזרה</Button>}>{error}</Empty></Card>;
  if (!topic) return <PageLoader label="טוען את העורך..." />;

  const up = (patch) => setTopic((t) => ({ ...t, ...patch }));
  const published = topic.status === 'published';

  const preview = async () => {
    if (dirty && !(await save())) return;
    navigate(`/topic/${topic.id}`);
  };

  const togglePublish = async () => {
    if (!published && problems.length) {
      const ok = await confirm({ title: 'יש שאלות שדורשות תיקון', message: `נמצאו ${problems.length} בעיות (למשל: ${problems[0]}). לפרסם בכל זאת?`, confirmText: 'פרסום בכל זאת' });
      if (!ok) return;
    }
    save({ status: published ? 'draft' : 'published' });
  };

  const tabs = [
    { id: 'details', label: 'פרטים', icon: Settings2 },
    { id: 'learn', label: 'הסברים', icon: BookOpen, count: topic.learnSections.length },
    { id: 'practice', label: 'תרגול', icon: Dumbbell, count: topic.practiceQuestions.length },
    { id: 'tips', label: 'טיפים', icon: Lightbulb, count: topic.tips.length },
    { id: 'exams', label: 'מבחנים', icon: GraduationCap, count: topic.exams.length },
    { id: 'stats', label: 'סטטיסטיקה', icon: BarChart3 },
  ];

  return (
    <div className="animate-rise pb-24">
      <button onClick={() => navigate('/admin/content')} className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-navy-900 mb-3 cursor-pointer"><ArrowRight size={16} /> כל הנושאים</button>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusPill color={published ? 'green' : 'grey'}>{published ? 'פורסם' : 'טיוטה'}</StatusPill>
            {topic.aiGenerated && <Chip color="purple"><Wand2 size={12} /> נוצר ב-AI – כדאי לעבור על התוכן</Chip>}
            <span className="text-sm text-slate-500">{topic.grade} {topic.level && `· ${topic.level}`}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mt-1.5"><Rich text={topic.title} /></h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="soft" icon={Eye} onClick={preview}>תצוגה כתלמיד</Button>
          <Button variant="soft" icon={Share2} onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/?topic=${topic.id}`); toast('קישור ההזמנה הועתק', 'success'); }}>קישור הזמנה</Button>
          <Button variant={published ? 'soft' : 'green'} icon={Rocket} loading={saving} onClick={togglePublish}>{published ? 'הסתרה (טיוטה)' : 'פרסום לתלמידים'}</Button>
        </div>
      </div>

      {problems.length > 0 && (
        <details className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-3 text-sm">
          <summary className="cursor-pointer font-bold text-amber-800 flex items-center gap-2"><AlertTriangle size={17} /> {problems.length} שאלות דורשות תשומת לב</summary>
          <ul className="mt-2 space-y-0.5 text-amber-900 list-disc pr-5">{problems.slice(0, 15).map((p, i) => <li key={i}>{p}</li>)}</ul>
        </details>
      )}

      <Tabs tabs={tabs} value={tab} onChange={(t) => { setTab(t); setOpenItem(null); }} className="mb-5" />

      {tab === 'details' && (
        <Card className="p-5 sm:p-6 space-y-4 max-w-3xl">
          <RichField single label="שם הנושא" value={topic.title} onChange={(v) => up({ title: v })} />
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="כיתה / מסגרת" hint="תלמידים עם 'גישה לשכבה' יראו את הנושא אוטומטית">
              <select className="field" value={topic.grade} onChange={(e) => up({ grade: e.target.value })}>
                <option value="">ללא</option>
                {[...new Set([...settings.grades, topic.grade].filter(Boolean))].map((g) => <option key={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="הקבצה / רמה"><input className="field" list="levels-list" value={topic.level} onChange={(e) => up({ level: e.target.value })} />
              <datalist id="levels-list">{settings.levels.map((l) => <option key={l} value={l} />)}</datalist></Field>
          </div>
          <RichField label="תיאור (מוצג בכרטיס הנושא)" rows={3} value={topic.description} onChange={(v) => up({ description: v })} />
          <Field label="תגית בולטת" hint='למשל: "חומר למבחן הקרוב!"'><input className="field" value={topic.badge} onChange={(e) => up({ badge: e.target.value })} /></Field>
          <Field label="צבע הנושא"><ColorPicker value={topic.color} onChange={(c) => up({ color: c })} /></Field>
        </Card>
      )}

      {tab === 'learn' && (
        <div className="space-y-3">
          {topic.learnSections.map((s, i) => (
            <ItemCard key={s.id} index={i} total={topic.learnSections.length} title={s.title} subtitle={s.summary?.replace(/\$/g, '').slice(0, 90)}
              open={openItem === s.id} onToggle={() => setOpenItem(openItem === s.id ? null : s.id)}
              onMove={(d) => up({ learnSections: move(topic.learnSections, i, d) })}
              onDuplicate={() => up({ learnSections: [...topic.learnSections.slice(0, i + 1), { ...s, id: newId('sec'), title: `${s.title} (עותק)` }, ...topic.learnSections.slice(i + 1)] })}
              onDelete={async () => { if (await confirm({ title: 'למחוק את הפרק?', danger: true, confirmText: 'מחיקה' })) up({ learnSections: topic.learnSections.filter((x) => x.id !== s.id) }); }}>
              <SectionForm s={s} onChange={(ns) => up({ learnSections: topic.learnSections.map((x) => (x.id === s.id ? ns : x)) })} />
            </ItemCard>
          ))}
          <Button variant="soft" icon={Plus} onClick={() => {
            const ns = { id: newId('sec'), title: `${topic.learnSections.length + 1}. פרק חדש`, summary: '', bullets: [''], workedExample: null, videoUrl: '', imageUrl: '', hasNumberLineExplorer: false };
            up({ learnSections: [...topic.learnSections, ns] }); setOpenItem(ns.id);
          }}>הוספת פרק הסבר</Button>
        </div>
      )}

      {tab === 'practice' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <p className="text-sm text-slate-500">{topic.practiceQuestions.length} שאלות · {subtopics.length} תתי-נושאים</p>
            <Button variant="gold" icon={Wand2} onClick={() => setAiModal('practice')}>עוד שאלות עם AI</Button>
          </div>
          {topic.practiceQuestions.map((q, i) => {
            const probs = questionProblems(q);
            return (
              <ItemCard key={q.id} index={i} total={topic.practiceQuestions.length} title={q.prompt} accent="border-r-st-green"
                subtitle={`${TYPE_LABELS[q.type]}${q.subtopic ? ` · ${q.subtopic}` : ''}`}
                badge={probs.length ? <AlertTriangle size={17} className="text-st-orange shrink-0" /> : null}
                open={openItem === q.id} onToggle={() => setOpenItem(openItem === q.id ? null : q.id)}
                onMove={(d) => up({ practiceQuestions: move(topic.practiceQuestions, i, d) })}
                onDuplicate={() => up({ practiceQuestions: [...topic.practiceQuestions.slice(0, i + 1), { ...structuredClone(q), id: newId('q') }, ...topic.practiceQuestions.slice(i + 1)] })}
                onDelete={async () => { if (await confirm({ title: 'למחוק את השאלה?', danger: true, confirmText: 'מחיקה' })) up({ practiceQuestions: topic.practiceQuestions.filter((x) => x.id !== q.id) }); }}>
                {probs.length > 0 && <div className="text-sm text-amber-700 bg-amber-50 rounded-xl p-2.5 font-semibold">⚠ {probs.join(' · ')}</div>}
                <QuestionEditor q={q} subtopics={subtopics} onChange={(nq) => up({ practiceQuestions: topic.practiceQuestions.map((x) => (x.id === q.id ? nq : x)) })} />
              </ItemCard>
            );
          })}
          <Button variant="soft" icon={Plus} onClick={() => {
            const nq = { ...blankQuestion('mcq'), subtopic: subtopics[subtopics.length - 1] || '' };
            up({ practiceQuestions: [...topic.practiceQuestions, nq] }); setOpenItem(nq.id);
          }}>הוספת שאלה</Button>
        </div>
      )}

      {tab === 'tips' && (
        <div className="space-y-3">
          {topic.tips.map((t, i) => (
            <ItemCard key={t.id} index={i} total={topic.tips.length} title={t.title} subtitle={t.tag} accent="border-r-st-orange"
              open={openItem === t.id} onToggle={() => setOpenItem(openItem === t.id ? null : t.id)}
              onMove={(d) => up({ tips: move(topic.tips, i, d) })}
              onDelete={async () => { if (await confirm({ title: 'למחוק את הטיפ?', danger: true, confirmText: 'מחיקה' })) up({ tips: topic.tips.filter((x) => x.id !== t.id) }); }}>
              <div className="grid sm:grid-cols-[1fr_200px] gap-3">
                <RichField single label="כותרת" value={t.title} onChange={(v) => up({ tips: topic.tips.map((x) => (x.id === t.id ? { ...x, title: v } : x)) })} />
                <Field label="תגית"><input className="field" value={t.tag} placeholder="מוקש! / חובה לזכור" onChange={(e) => up({ tips: topic.tips.map((x) => (x.id === t.id ? { ...x, tag: e.target.value } : x)) })} /></Field>
              </div>
              <RichField label="תוכן הטיפ" rows={4} value={t.content} onChange={(v) => up({ tips: topic.tips.map((x) => (x.id === t.id ? { ...x, content: v } : x)) })} />
            </ItemCard>
          ))}
          <Button variant="soft" icon={Plus} onClick={() => { const nt = { id: newId('tip'), title: '', tag: '', content: '' }; up({ tips: [...topic.tips, nt] }); setOpenItem(nt.id); }}>הוספת טיפ</Button>
        </div>
      )}

      {tab === 'exams' && (
        <div className="space-y-5">
          <div className="flex justify-end"><Button variant="gold" icon={Wand2} onClick={() => setAiModal('exam')}>מבחן חדש עם AI</Button></div>
          {topic.exams.map((e, ei) => (
            <Card key={e.id} className="p-4 sm:p-5 border-r-[5px] !border-r-st-purple">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-black text-lg flex items-center gap-2"><GraduationCap className="text-st-purple" /> מבחן {ei + 1}</h3>
                <div className="flex gap-1">
                  <Button size="xs" variant="ghost" disabled={ei === 0} onClick={() => up({ exams: move(topic.exams, ei, -1) })}>▲</Button>
                  <Button size="xs" variant="ghost" disabled={ei === topic.exams.length - 1} onClick={() => up({ exams: move(topic.exams, ei, 1) })}>▼</Button>
                  <Button size="xs" variant="dangerSoft" onClick={async () => { if (await confirm({ title: 'למחוק את המבחן?', danger: true, confirmText: 'מחיקה' })) up({ exams: topic.exams.filter((x) => x.id !== e.id) }); }}>מחיקה</Button>
                </div>
              </div>
              {(() => {
                const setExam = (patch) => up({ exams: topic.exams.map((x) => (x.id === e.id ? { ...x, ...patch } : x)) });
                return (
                  <div className="space-y-3">
                    <div className="grid sm:grid-cols-[1fr_200px_150px] gap-3">
                      <RichField single label="שם המבחן" value={e.title} onChange={(v) => setExam({ title: v })} />
                      <Field label="תגית רמה"><input className="field" value={e.levelBadge} onChange={(ev) => setExam({ levelBadge: ev.target.value })} placeholder="רמה בסיסית" /></Field>
                      <Field label="מגבלת זמן (דקות)" hint="0 = ללא"><input className="field" type="number" min="0" dir="ltr" value={e.timeLimitMin} onChange={(ev) => setExam({ timeLimitMin: Math.max(0, Number(ev.target.value) || 0) })} /></Field>
                    </div>
                    <RichField label="תיאור" value={e.description} onChange={(v) => setExam({ description: v })} />
                    <div className="space-y-2">
                      {e.questions.map((q, qi) => (
                        <ItemCard key={q.id} index={qi} total={e.questions.length} title={q.prompt} subtitle={TYPE_LABELS[q.type]} accent="border-r-st-purple"
                          badge={questionProblems(q).length ? <AlertTriangle size={17} className="text-st-orange shrink-0" /> : null}
                          open={openItem === q.id} onToggle={() => setOpenItem(openItem === q.id ? null : q.id)}
                          onMove={(d) => setExam({ questions: move(e.questions, qi, d) })}
                          onDuplicate={() => setExam({ questions: [...e.questions.slice(0, qi + 1), { ...structuredClone(q), id: newId('eq') }, ...e.questions.slice(qi + 1)] })}
                          onDelete={() => setExam({ questions: e.questions.filter((x) => x.id !== q.id) })}>
                          <QuestionEditor exam q={q} onChange={(nq) => setExam({ questions: e.questions.map((x) => (x.id === q.id ? nq : x)) })} />
                        </ItemCard>
                      ))}
                    </div>
                    <Button size="sm" variant="soft" icon={Plus} onClick={() => { const nq = blankQuestion('mcq', true); setExam({ questions: [...e.questions, nq] }); setOpenItem(nq.id); }}>הוספת שאלה למבחן</Button>
                  </div>
                );
              })()}
            </Card>
          ))}
          <Button variant="soft" icon={Plus} onClick={() => up({ exams: [...topic.exams, { id: newId('exam'), title: `מבחן ${topic.exams.length + 1}`, levelBadge: '', description: '', timeLimitMin: 0, questions: [] }] })}>הוספת מבחן ריק</Button>
        </div>
      )}

      {tab === 'stats' && <TopicStats topicId={topic.id} />}

      {/* sticky save bar (portaled so it is always pinned to the viewport) */}
      {createPortal(
      <div dir="rtl" className={cx('fixed bottom-0 left-0 right-0 lg:right-64 z-30 transition-transform duration-300', dirty ? 'translate-y-0' : 'translate-y-[120%]')}>
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 pb-4">
          <div className="bg-navy-900 text-white rounded-2xl shadow-[var(--shadow-pop)] px-4 py-3 flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-gold-400 animate-pulse" />
            <span className="flex-1 font-bold text-sm">יש שינויים שלא נשמרו {published && <span className="text-white/60 font-normal">· השמירה תתעדכן מיד אצל התלמידים</span>}</span>
            <Button variant="ghost" size="sm" className="!text-white/70 hover:!bg-white/10" onClick={() => setTopic(JSON.parse(saved))}>ביטול שינויים</Button>
            <Button variant="gold" size="sm" icon={Save} loading={saving} onClick={() => save()}>שמירה (Ctrl+S)</Button>
          </div>
        </div>
      </div>, document.body)}

      <AiExtendModal kind={aiModal} topic={topic} dirty={dirty} onSaveFirst={() => save()} onClose={() => setAiModal(null)} onDone={async () => { await load(); setAiModal(null); }} />
    </div>
  );
}

function SectionForm({ s, onChange }) {
  const set = (patch) => onChange({ ...s, ...patch });
  return (
    <>
      <RichField single label="כותרת הפרק" value={s.title} onChange={(v) => set({ title: v })} />
      <RichField label="הסבר קצר" rows={3} value={s.summary} onChange={(v) => set({ summary: v })} hint="ביטויים מתמטיים בתוך $...$ · הדגשה: **טקסט**" />
      <StringList label="נקודות עיקריות" items={s.bullets} onChange={(bullets) => set({ bullets })} addLabel="נקודה" rows={2} />
      <div className="rounded-2xl border border-dashed border-gold-400 p-4 bg-gold-200/20 space-y-3">
        <Toggle checked={!!s.workedExample} onChange={(v) => set({ workedExample: v ? { problem: '', steps: [''] } : null })} label="דוגמה פתורה שלב-אחר-שלב" />
        {s.workedExample && (
          <>
            <RichField single label="התרגיל" value={s.workedExample.problem} onChange={(v) => set({ workedExample: { ...s.workedExample, problem: v } })} />
            <StringList label="שלבי הפתרון (התלמיד חושף אחד-אחד)" items={s.workedExample.steps} numbered onChange={(steps) => set({ workedExample: { ...s.workedExample, steps } })} addLabel="שלב" rows={2} />
          </>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="סרטון (YouTube / Drive / Vimeo)"><input className="field" dir="ltr" value={s.videoUrl} onChange={(e) => set({ videoUrl: e.target.value })} placeholder="https://youtu.be/..." /></Field>
        <ImageField value={s.imageUrl} onChange={(v) => set({ imageUrl: v })} />
      </div>
      <Toggle checked={!!s.hasNumberLineExplorer} onChange={(v) => set({ hasNumberLineExplorer: v })} label="להציג 'חוקר ציר המספרים' האינטראקטיבי" />
    </>
  );
}

function AiExtendModal({ kind, topic, dirty, onSaveFirst, onClose, onDone }) {
  const { toast } = useUi();
  const poll = useJobPoller();
  const [count, setCount] = useState(10);
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (kind) { setCount(kind === 'exam' ? 8 : 10); setInstructions(''); } }, [kind]);

  const run = async () => {
    setBusy(true);
    try {
      if (dirty && !(await onSaveFirst())) throw new Error('יש לשמור את השינויים לפני היצירה');
      const { job } = await api.post(`/api/admin/ai/topics/${topic.id}/extend`, { kind, count, instructions });
      await poll(job.id);
      toast(kind === 'exam' ? 'מבחן חדש נוסף! עברי עליו ושמרי.' : `${count} שאלות חדשות נוספו לסוף הרשימה ✨`, 'success');
      await onDone();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <Modal open={!!kind} onClose={busy ? undefined : onClose} icon={Wand2} title={kind === 'exam' ? 'יצירת מבחן נוסף עם AI' : 'יצירת שאלות תרגול נוספות עם AI'}
      subtitle="ה-AI יכיר את ההסברים והשאלות הקיימות וייצור תוכן חדש שלא חוזר על עצמו">
      {busy ? (
        <div className="py-10 text-center">
          <Loader2 className="animate-spin mx-auto text-st-purple" size={42} />
          <p className="font-black mt-4">ה-AI עובד על זה...</p>
          <p className="text-sm text-slate-500 mt-1 flex items-center justify-center gap-1"><Clock size={14} /> בדרך כלל לוקח 20–60 שניות</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label={kind === 'exam' ? 'מספר שאלות במבחן' : 'מספר שאלות'}>
            <div className="flex gap-2">{(kind === 'exam' ? [6, 8, 10, 12] : [5, 10, 15, 20]).map((n) => (
              <button key={n} type="button" onClick={() => setCount(n)} className={cx('flex-1 h-11 rounded-xl font-black border-2 cursor-pointer', count === n ? 'bg-st-purple border-st-purple text-white' : 'border-line bg-white')}>{n}</button>
            ))}</div>
          </Field>
          <Field label="הנחיות מיוחדות (לא חובה)"><textarea className="field" rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="למשל: יותר בעיות מילוליות, רמה קשה יותר, להתמקד בחזקות..." /></Field>
          <div className="flex justify-end gap-2"><Button variant="soft" onClick={onClose}>ביטול</Button><Button variant="gold" icon={Wand2} onClick={run}>יצירה</Button></div>
        </div>
      )}
    </Modal>
  );
}

function TopicStats({ topicId }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.get(`/api/admin/topics/${topicId}/stats`).then(setData).catch(() => setData({ questions: [] })); }, [topicId]);
  if (!data) return <PageLoader />;
  const withData = data.questions.filter((q) => q.attempts > 0);
  if (!withData.length) return <Card><Empty icon={BarChart3} title="עוד אין נתונים">כשתלמידים יתרגלו – תראי כאן אילו שאלות הכי קשות להם.</Empty></Card>;
  const sorted = [...data.questions].sort((a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101));
  return (
    <Card className="overflow-x-auto scroll-thin">
      <table className="w-full text-sm min-w-[700px]">
        <thead><tr className="text-xs text-slate-500 border-b border-line"><th className="p-3 text-right">שאלה</th><th className="p-2">תת-נושא</th><th className="p-2">תלמידים</th><th className="p-2">ניסיונות</th><th className="p-2 w-28">הצלחה</th></tr></thead>
        <tbody>
          {sorted.map((q) => (
            <tr key={q.id} className="border-b border-line last:border-0">
              <td className="p-3"><span className="text-xs text-slate-400 ml-2">#{q.index}</span><Rich text={q.prompt.length > 110 ? q.prompt.slice(0, 110) + '…' : q.prompt} /></td>
              <td className="p-2 text-center text-slate-500">{q.subtopic}</td>
              <td className="p-2 text-center">{q.users}</td>
              <td className="p-2 text-center">{q.attempts}</td>
              <td className="p-1.5">{q.accuracy === null ? <div className="text-center text-slate-300">—</div> : <StatusPill cell className="rounded-lg" color={q.accuracy >= 75 ? 'green' : q.accuracy >= 50 ? 'orange' : 'red'}>{q.accuracy}%</StatusPill>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-slate-400 p-3 flex items-center gap-1"><CheckCircle2 size={13} /> השאלות הקשות ביותר מופיעות ראשונות – אולי כדאי לחדד את הניסוח או להוסיף רמז.</p>
    </Card>
  );
}

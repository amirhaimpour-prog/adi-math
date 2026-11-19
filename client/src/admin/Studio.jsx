import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wand2, UploadCloud, FileText, Link2, Type, X, Sparkles, BookOpen, Dumbbell, Lightbulb, GraduationCap, AlertTriangle, CheckCircle2, Settings, Clock, FileImage } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { Button, Card, Field, cx, useUi, timeAgo, StatusPill } from '../ui/ui.jsx';
import { burst } from '../lib/fx.js';
import { PageHeader, useFetch } from './AdminApp.jsx';
import { ColorPicker } from './Topics.jsx';
import { useJobPoller } from './Editor.jsx';

const STAGES = [
  { id: 'reading', label: 'קוראת את החומר', icon: FileText },
  { id: 'thinking', label: 'בונה הסברים, תרגילים ומבחנים', icon: Sparkles },
  { id: 'building', label: 'מסדרת את הלומדה', icon: BookOpen },
  { id: 'done', label: 'מוכן!', icon: CheckCircle2 },
];
const FUN = [
  'מחשבת מסיחים חכמים לשאלות האמריקאיות...', 'בודקת כל חישוב פעמיים...', 'מנסחת רמזים שלא מגלים את התשובה...',
  'מחפשת את המוקשים הקלאסיים של המבחנים...', 'מתרגמת נוסחאות ל-LaTeX מושלם...', 'מדרגת את השאלות מקל לקשה...',
];

export default function Studio() {
  const { settings } = useApp();
  const { toast } = useUi();
  const navigate = useNavigate();
  const poll = useJobPoller();
  const { data: cfg } = useFetch('/api/admin/settings');
  const { data: jobsData, reload: reloadJobs } = useFetch('/api/admin/ai/jobs');
  const [files, setFiles] = useState([]);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [drag, setDrag] = useState(false);
  const [f, setF] = useState({ title: '', grade: '', level: '', color: 'purple', practiceCount: 24, examCount: 2, examSize: 8, difficulty: 'mixed', instructions: '' });
  const [job, setJob] = useState(null);
  const [fun, setFun] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!job || job.status !== 'running') return undefined;
    const t = setInterval(() => setFun((x) => (x + 1) % FUN.length), 3200);
    return () => clearInterval(t);
  }, [job]);

  const addFiles = (list) => {
    const arr = [...list].filter((x) => x.size <= 18 * 1024 * 1024);
    if (arr.length < list.length) toast('קבצים מעל 18MB לא נוספו', 'warning');
    setFiles((cur) => [...cur, ...arr].slice(0, 5));
  };

  const start = async () => {
    if (!files.length && !url.trim() && !text.trim()) return toast('העלי קובץ, הדביקי קישור או כתבי טקסט', 'warning');
    const fd = new FormData();
    files.forEach((x) => fd.append('files', x));
    fd.append('url', url);
    fd.append('text', text);
    Object.entries(f).forEach(([k, v]) => fd.append(k, String(v)));
    try {
      setJob({ status: 'running', stage: 'reading' });
      const { job: j } = await api.form('/api/admin/ai/generate', fd);
      setJob(j);
      const done = await poll(j.id, setJob);
      burst();
      toast('הלומדה מוכנה! עברי על התוכן ופרסמי כשנוח לך ✨', 'success');
      reloadJobs();
      setTimeout(() => navigate(`/admin/content/${done.topicId}`), 900);
    } catch (e) {
      setJob({ status: 'error', error: e.message });
      reloadJobs();
    }
  };

  const keyMissing = cfg && !cfg.settings.geminiKeySet && !cfg.settings.openaiKeySet;
  const running = job?.status === 'running';
  const stageIdx = Math.max(0, STAGES.findIndex((s) => s.id === job?.stage));

  return (
    <div className="animate-rise">
      <PageHeader title="סטודיו AI" subtitle="מעלים חומר גלם – מקבלים יחידת לומדה שלמה: הסברים, תרגול אינטראקטיבי, טיפים ומבחנים" icon={Wand2} color="bg-gradient-to-br from-st-purple to-[#6161ff]" />

      {keyMissing && (
        <div className="mb-5 rounded-2xl bg-amber-50 border-2 border-amber-200 p-4 flex flex-wrap items-center gap-3">
          <AlertTriangle className="text-amber-600" />
          <div className="flex-1 min-w-60"><b>צריך לחבר מנוע AI פעם אחת.</b> <span className="text-sm text-slate-600">מדביקים מפתח של GPT (OpenAI) או של Gemini במסך ההגדרות – ההסבר המלא נמצא שם.</span></div>
          <Button icon={Settings} onClick={() => navigate('/admin/settings')}>להגדרות</Button>
        </div>
      )}

      {running || job?.status === 'done' ? (
        <Card className="p-8 sm:p-12 text-center max-w-2xl mx-auto">
          <div className="relative w-28 h-28 mx-auto">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-st-purple to-gold-400 animate-spin [animation-duration:3s] blur-md opacity-60" />
            <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center"><Wand2 size={44} className="text-st-purple animate-[float_2s_ease-in-out_infinite]" /></div>
          </div>
          <h2 className="text-2xl font-black mt-6">{job?.status === 'done' ? 'הלומדה מוכנה! 🎉' : 'ה-AI בונה את הלומדה שלך...'}</h2>
          <p className="text-slate-500 mt-1 h-6 transition">{job?.status === 'done' ? 'פותחת את העורך...' : FUN[fun]}</p>
          <div className="mt-8 space-y-2 text-right max-w-sm mx-auto">
            {STAGES.map((s, i) => (
              <div key={s.id} className={cx('flex items-center gap-3 p-3 rounded-xl transition', i < stageIdx || job?.status === 'done' ? 'bg-emerald-50 text-emerald-800' : i === stageIdx ? 'bg-purple-50 text-purple-800 font-black' : 'text-slate-400')}>
                {i < stageIdx || job?.status === 'done' ? <CheckCircle2 size={20} /> : i === stageIdx ? <span className="w-5 h-5 rounded-full border-[3px] border-st-purple border-t-transparent animate-spin" /> : <s.icon size={20} />}
                <span className="font-bold">{s.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-6 flex items-center justify-center gap-1"><Clock size={13} /> בדרך כלל 30–120 שניות. אפשר להמשיך לעבוד – הנושא יישמר כטיוטה.</p>
        </Card>
      ) : (
        <div className="grid xl:grid-cols-[1.3fr_1fr] gap-5 items-start">
          <div className="space-y-5">
            {job?.status === 'error' && (
              <div className="rounded-2xl bg-rose-50 border-2 border-rose-200 p-4 flex items-start gap-3 animate-pop">
                <AlertTriangle className="text-rose-600 shrink-0" />
                <div className="flex-1"><b className="text-rose-800">היצירה לא הצליחה</b><p className="text-sm text-rose-900 mt-0.5">{job.error}</p></div>
                <button onClick={() => setJob(null)} className="text-rose-400 cursor-pointer"><X size={18} /></button>
              </div>
            )}

            <Card className="p-5 sm:p-6">
              <h3 className="font-black text-lg flex items-center gap-2 mb-1"><span className="w-7 h-7 rounded-lg bg-navy-900 text-white text-sm flex items-center justify-center">1</span> חומר המקור</h3>
              <p className="text-sm text-slate-500 mb-4">אפשר לשלב: קובץ + קישור + טקסט. ככל שהחומר עשיר יותר – הלומדה טובה יותר.</p>

              <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
                onClick={() => inputRef.current.click()}
                className={cx('rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition', drag ? 'border-st-purple bg-purple-50 scale-[1.01]' : 'border-slate-300 hover:border-st-purple hover:bg-purple-50/40')}>
                <UploadCloud size={44} className="mx-auto text-st-purple" />
                <div className="font-black mt-2">גררי לכאן קבצים או לחצי לבחירה</div>
                <div className="text-sm text-slate-500 mt-1">PDF של דף עבודה / מבחן · צילום עמוד מספר · Word (docx) · עד 5 קבצים, 18MB כל אחד</div>
                <input ref={inputRef} type="file" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.docx,.txt,.md,image/*,application/pdf"
                  onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
              </div>
              {files.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {files.map((x, i) => (
                    <li key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2">
                      {x.type.startsWith('image/') ? <FileImage size={18} className="text-st-blue" /> : <FileText size={18} className="text-st-red" />}
                      <span className="flex-1 text-sm font-semibold truncate" dir="ltr">{x.name}</span>
                      <span className="text-xs text-slate-400">{(x.size / 1024 / 1024).toFixed(1)}MB</span>
                      <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-600 cursor-pointer" aria-label="הסרה"><X size={16} /></button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid gap-3 mt-4">
                <Field label={<span className="flex items-center gap-1.5"><Link2 size={15} /> קישור (אתר, YouTube, Google Drive)</span>}>
                  <input className="field" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
                </Field>
                <Field label={<span className="flex items-center gap-1.5"><Type size={15} /> טקסט חופשי / הנחיות תוכן</span>}>
                  <textarea className="field" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="אפשר להדביק כאן חומר, רשימת תרגילים, או פשוט לכתוב: 'משוואות ממעלה ראשונה לכיתה ז׳ – כולל בעיות מילוליות'" />
                </Field>
              </div>
            </Card>
          </div>

          <div className="space-y-5">
            <Card className="p-5 sm:p-6 space-y-4">
              <h3 className="font-black text-lg flex items-center gap-2"><span className="w-7 h-7 rounded-lg bg-navy-900 text-white text-sm flex items-center justify-center">2</span> הגדרות היחידה</h3>
              <Field label="שם הנושא" hint="אם ריק – ה-AI יבחר שם"><input className="field" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="למשל: משוואות ממעלה ראשונה" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="כיתה"><select className="field" value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })}><option value="">—</option>{settings.grades.map((g) => <option key={g}>{g}</option>)}</select></Field>
                <Field label="הקבצה"><select className="field" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}><option value="">כל הרמות</option>{settings.levels.map((g) => <option key={g}>{g}</option>)}</select></Field>
              </div>
              <Field label="רמת קושי">
                <div className="grid grid-cols-3 gap-2">
                  {[['easy', 'בסיסית'], ['mixed', 'מדורגת'], ['hard', 'מאתגרת']].map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setF({ ...f, difficulty: v })} className={cx('h-10 rounded-xl font-bold border-2 cursor-pointer text-sm', f.difficulty === v ? 'bg-st-purple text-white border-st-purple' : 'bg-white border-line')}>{l}</button>
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label={<span className="flex items-center gap-1"><Dumbbell size={14} /> תרגילים</span>}><input className="field" type="number" min="6" max="50" dir="ltr" value={f.practiceCount} onChange={(e) => setF({ ...f, practiceCount: e.target.value })} /></Field>
                <Field label={<span className="flex items-center gap-1"><GraduationCap size={14} /> מבחנים</span>}><input className="field" type="number" min="0" max="4" dir="ltr" value={f.examCount} onChange={(e) => setF({ ...f, examCount: e.target.value })} /></Field>
                <Field label="שאלות למבחן"><input className="field" type="number" min="4" max="20" dir="ltr" value={f.examSize} onChange={(e) => setF({ ...f, examSize: e.target.value })} /></Field>
              </div>
              <Field label="הנחיות לסגנון (לא חובה)"><textarea className="field" rows={2} value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} placeholder="למשל: מרתון לפני מבחן של חטיבת טהרלב, הרבה מוקשים" /></Field>
              <Field label="צבע"><ColorPicker value={f.color} onChange={(c) => setF({ ...f, color: c })} /></Field>
              <Button variant="gold" size="lg" icon={Wand2} className="w-full" disabled={keyMissing} onClick={start}>בניית הלומדה</Button>
              <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-bold text-slate-500">
                <div className="bg-blue-50 rounded-xl p-2"><BookOpen size={16} className="mx-auto text-st-blue mb-0.5" />הסברים</div>
                <div className="bg-emerald-50 rounded-xl p-2"><Dumbbell size={16} className="mx-auto text-st-green mb-0.5" />תרגול</div>
                <div className="bg-amber-50 rounded-xl p-2"><Lightbulb size={16} className="mx-auto text-st-orange mb-0.5" />טיפים</div>
                <div className="bg-purple-50 rounded-xl p-2"><GraduationCap size={16} className="mx-auto text-st-purple mb-0.5" />מבחנים</div>
              </div>
            </Card>

            {jobsData?.jobs?.length > 0 && (
              <Card className="p-5">
                <h3 className="font-black mb-2">יצירות אחרונות</h3>
                <ul className="divide-y divide-line">
                  {jobsData.jobs.slice(0, 6).map((j) => (
                    <li key={j.id} className="py-2 flex items-center gap-2 text-sm">
                      <StatusPill color={j.status === 'done' ? 'green' : j.status === 'error' ? 'red' : 'orange'} className="!h-6 !text-[11px] !px-2">{j.status === 'done' ? 'הושלם' : j.status === 'error' ? 'נכשל' : 'בתהליך'}</StatusPill>
                      <span className="flex-1 truncate" title={j.error}>{j.sourceName}</span>
                      <span className="text-xs text-slate-400">{timeAgo(j.createdAt)}</span>
                      {j.status === 'done' && j.topicId && <Button size="xs" variant="soft" onClick={() => navigate(`/admin/content/${j.topicId}`)}>פתיחה</Button>}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, BookOpen, Dumbbell, Lightbulb, GraduationCap, ChevronLeft, Eye, PlayCircle, Sparkles, CheckCircle2, Minus, Plus } from 'lucide-react';
import { api } from '../lib/api.js';
import { Button, Card, Empty, PageLoader, ProgressBar, cx, topicColor, useUi, Chip } from '../ui/ui.jsx';
import { Rich } from '../lib/Rich.jsx';
import { sfx } from '../lib/fx.js';
import Practice from './Practice.jsx';
import Exams from './Exams.jsx';

const TABS = [
  { id: 'learn', label: 'הסבר החומר', icon: BookOpen, color: 'bg-st-blue' },
  { id: 'practice', label: 'תרגול', icon: Dumbbell, color: 'bg-st-green' },
  { id: 'tips', label: 'הטיפים של עדי', icon: Lightbulb, color: 'bg-st-orange' },
  { id: 'exam', label: 'מבחנים', icon: GraduationCap, color: 'bg-st-purple' },
];

export function videoEmbed(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const drive = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  if (/vimeo\.com\/(\d+)/.test(url)) return `https://player.vimeo.com/video/${url.match(/vimeo\.com\/(\d+)/)[1]}`;
  return null;
}

export default function TopicView({ preview = false }) {
  const params = useParams();
  const topicId = params.topicId;
  const tab = (params['*'] || 'learn').split('/')[0] || 'learn';
  const navigate = useNavigate();
  const { toast } = useUi();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get(`/api/topics/${topicId}`).then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message));
  }, [topicId]);
  useEffect(() => { load(); }, [load]);

  const setTab = (t) => { sfx.click(); navigate(`/topic/${topicId}/${t}`, { replace: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const onSolved = useCallback((qid) => {
    setData((d) => (d.progress.solvedIds.includes(qid) ? d : { ...d, progress: { ...d.progress, solvedIds: [...d.progress.solvedIds, qid], solved: d.progress.solved + 1 } }));
  }, []);

  if (error) {
    return <Card><Empty title="לא ניתן לפתוח את הנושא" action={<Button onClick={() => navigate('/')} icon={ArrowRight}>חזרה ללובי</Button>}>{error}</Empty></Card>;
  }
  if (!data) return <PageLoader label="פותחים את יחידת הלימוד..." />;
  const { topic, progress } = data;
  const c = topicColor(topic);

  return (
    <div className="space-y-5 animate-rise">
      <div className={cx('rounded-3xl bg-gradient-to-l text-white p-5 sm:p-7 relative overflow-hidden shadow-[var(--shadow-pop)]', c.bg)}>
        <div className="absolute -left-6 -bottom-10 text-[10rem] leading-none font-black text-white/10 select-none">∑</div>
        <div className="relative">
          {!preview && (
            <button onClick={() => navigate('/')} className="inline-flex items-center gap-1 text-white/85 hover:text-white text-sm font-bold mb-3 cursor-pointer">
              <ArrowRight size={16} /> חזרה לכל הנושאים
            </button>
          )}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="bg-white/20 px-2.5 py-1 rounded-lg text-xs font-bold">{topic.grade}{topic.level ? ` · ${topic.level}` : ''}</span>
            {topic.badge && <span className="bg-white text-navy-900 px-2.5 py-1 rounded-lg text-xs font-black">{topic.badge}</span>}
            {data.preview && <span className="bg-st-purple px-2.5 py-1 rounded-lg text-xs font-black">טיוטה – לא גלוי לתלמידים</span>}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black"><Rich text={topic.title} /></h1>
          {topic.description && <p className={cx('text-white/85 mt-2 max-w-3xl leading-relaxed', tab !== 'learn' && 'hidden sm:block')}><Rich text={topic.description} /></p>}
          <div className={cx('mt-4 max-w-sm', tab !== 'learn' && 'hidden sm:block')}>
            <div className="flex justify-between text-xs font-bold mb-1"><span>התקדמות בתרגול</span><span>{progress.solved}/{progress.total}</span></div>
            <ProgressBar value={progress.total ? progress.solved / progress.total : 0} color="bg-white" className="!bg-white/25" />
          </div>
        </div>
      </div>

      <div className="sticky top-16 z-20 -mx-3 sm:mx-0 px-3 sm:px-0 py-2 bg-canvas/90 backdrop-blur">
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 bg-white p-1.5 rounded-2xl border border-line shadow-[var(--shadow-card)]">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cx('btn-press flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:h-12 rounded-xl font-bold text-xs sm:text-[15px] cursor-pointer',
                tab === t.id ? `${t.color} text-white shadow-md` : 'text-slate-500 hover:bg-slate-50 hover:text-navy-900')}>
              <t.icon size={19} />{t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'learn' && <Learn topic={topic} onPractice={() => setTab('practice')} />}
      {tab === 'practice' && <Practice topic={topic} progress={progress} onSolved={onSolved} />}
      {tab === 'tips' && <Tips topic={topic} />}
      {tab === 'exam' && <Exams topic={topic} results={data.examResults} onDone={load} />}
    </div>
  );
}

// ------------------------------------------------------------------ Learn
function NumberLineExplorer() {
  const [v, setV] = useState(-3);
  const min = -10;
  const max = 10;
  return (
    <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 mt-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <span className="font-black text-sky-900 flex items-center gap-2"><Sparkles size={18} /> חוקר ציר המספרים</span>
        <div className="flex items-center gap-2" dir="ltr">
          <Button size="sm" variant="soft" icon={Minus} onClick={() => setV(Math.max(min, v - 1))} aria-label="פחות" />
          <span className="w-14 text-center font-black text-xl">{v}</span>
          <Button size="sm" variant="soft" icon={Plus} onClick={() => setV(Math.min(max, v + 1))} aria-label="יותר" />
        </div>
      </div>
      <div dir="ltr" className="relative h-14 mx-3">
        <div className="absolute top-5 left-0 right-0 h-1 bg-navy-800 rounded" />
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
          <button key={n} onClick={() => setV(n)} className="absolute -translate-x-1/2 top-2 flex flex-col items-center cursor-pointer" style={{ left: `${((n - min) / (max - min)) * 100}%` }}>
            <span className={cx('w-0.5 h-6', n === 0 ? 'bg-navy-900 w-1' : 'bg-navy-600')} />
            <span className={cx('text-[11px] font-bold', n === v ? 'text-st-blue font-black' : 'text-slate-500')}>{n}</span>
          </button>
        ))}
        <div className="absolute top-1 h-8 w-8 -translate-x-1/2 rounded-full bg-st-blue/90 border-4 border-white shadow-lg transition-all duration-300" style={{ left: `${((v - min) / (max - min)) * 100}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center text-sm">
        <div className="bg-white rounded-xl p-2"><div className="text-slate-500 text-xs font-bold">המספר</div><div className="font-black" dir="ltr">{v}</div></div>
        <div className="bg-white rounded-xl p-2"><div className="text-slate-500 text-xs font-bold">הנגדי</div><div className="font-black" dir="ltr">{v === 0 ? 0 : -v}</div></div>
        <div className="bg-white rounded-xl p-2"><div className="text-slate-500 text-xs font-bold">ערך מוחלט</div><div className="font-black" dir="ltr">|{v}| = {Math.abs(v)}</div></div>
      </div>
    </div>
  );
}

function WorkedExample({ ex }) {
  const [shown, setShown] = useState(0);
  const total = ex.steps.length;
  return (
    <div className="mt-5 rounded-2xl border-2 border-dashed border-gold-400 bg-gold-200/25 p-4 sm:p-5">
      <div className="flex items-center gap-2 text-gold-600 font-black text-sm mb-2"><PlayCircle size={18} /> דוגמה פתורה – נסו לפתור לבד לפני שחושפים!</div>
      <div className="text-lg font-bold"><Rich text={ex.problem} /></div>
      <ol className="mt-3 space-y-2">
        {ex.steps.slice(0, shown).map((s, i) => (
          <li key={i} className="flex gap-3 items-start bg-white rounded-xl p-3 border border-line animate-pop">
            <span className="w-7 h-7 rounded-lg bg-navy-900 text-white text-xs font-black flex items-center justify-center shrink-0">{i + 1}</span>
            <Rich text={s} className="leading-relaxed pt-0.5" />
          </li>
        ))}
      </ol>
      <div className="flex gap-2 mt-3">
        {shown < total ? (
          <Button size="sm" variant="gold" icon={Eye} onClick={() => { sfx.click(); setShown(shown + 1); }}>
            {shown === 0 ? 'הצג שלב ראשון' : `הצג שלב הבא (${shown}/${total})`}
          </Button>
        ) : (
          <span className="text-sm font-bold text-emerald-700 flex items-center gap-1"><CheckCircle2 size={17} /> כל השלבים נחשפו</span>
        )}
        {shown > 0 && shown < total && <Button size="sm" variant="ghost" onClick={() => setShown(total)}>הצג הכל</Button>}
        {shown > 0 && <Button size="sm" variant="ghost" onClick={() => setShown(0)}>הסתר</Button>}
      </div>
    </div>
  );
}

function Learn({ topic, onPractice }) {
  const [active, setActive] = useState(0);
  if (!topic.learnSections.length) return <Card><Empty icon={BookOpen} title="אין עדיין הסברים בנושא הזה" action={<Button onClick={onPractice}>לתרגול</Button>} /></Card>;
  const s = topic.learnSections[active];
  const embed = videoEmbed(s.videoUrl);
  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-5 items-start">
      <nav className="lg:sticky lg:top-36 flex lg:flex-col gap-2 overflow-x-auto scroll-thin pb-1">
        {topic.learnSections.map((sec, i) => (
          <button key={sec.id} onClick={() => { setActive(i); sfx.click(); }}
            className={cx('btn-press text-right flex items-center gap-2.5 p-3 rounded-2xl border-2 min-w-52 lg:min-w-0 cursor-pointer',
              i === active ? 'border-st-blue bg-white shadow-[var(--shadow-card)]' : 'border-transparent bg-white/60 hover:bg-white')}>
            <span className={cx('w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black shrink-0', i === active ? 'bg-st-blue text-white' : i < active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
              {i < active ? <CheckCircle2 size={16} /> : i + 1}
            </span>
            <span className="text-sm font-bold leading-snug"><Rich text={sec.title.replace(/^\d+\.\s*/, '')} /></span>
          </button>
        ))}
      </nav>
      <Card className="p-5 sm:p-7" key={s.id}>
        <div className="animate-pop">
          <Chip color="blue">פרק {active + 1} מתוך {topic.learnSections.length}</Chip>
          <h2 className="text-2xl font-black mt-2"><Rich text={s.title} /></h2>
          {s.summary && <p className="text-[17px] text-slate-700 leading-relaxed mt-3"><Rich text={s.summary} /></p>}
          {s.imageUrl && <img src={s.imageUrl} alt="" className="mt-4 rounded-2xl border border-line max-h-96 object-contain mx-auto" loading="lazy" />}
          {s.bullets.length > 0 && (
            <ul className="mt-4 space-y-2.5">
              {s.bullets.map((b, i) => (
                <li key={i} className="flex gap-3 items-start bg-slate-50 rounded-xl p-3.5">
                  <span className="w-2 h-2 rounded-full bg-st-blue mt-2.5 shrink-0" />
                  <Rich text={b} className="leading-relaxed text-[16px]" />
                </li>
              ))}
            </ul>
          )}
          {s.hasNumberLineExplorer && <NumberLineExplorer />}
          {embed && (
            <div className="mt-5 aspect-video rounded-2xl overflow-hidden border border-line bg-black">
              <iframe src={embed} title="סרטון הסבר" className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
            </div>
          )}
          {!embed && s.videoUrl && <a href={s.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-4 font-bold text-st-blue"><PlayCircle size={18} /> צפייה בסרטון ההסבר</a>}
          {s.workedExample && <WorkedExample ex={s.workedExample} key={s.id} />}
          <div className="flex justify-between gap-2 mt-7 pt-5 border-t border-line">
            <Button variant="soft" icon={ArrowRight} disabled={active === 0} onClick={() => { setActive(active - 1); window.scrollTo({ top: 200, behavior: 'smooth' }); }}>הקודם</Button>
            {active < topic.learnSections.length - 1 ? (
              <Button variant="blue" onClick={() => { setActive(active + 1); sfx.click(); window.scrollTo({ top: 200, behavior: 'smooth' }); }}>לפרק הבא <ChevronLeft size={18} /></Button>
            ) : (
              <Button variant="green" icon={Dumbbell} onClick={onPractice}>הבנתי! בואו נתרגל</Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ Tips
const TIP_STYLES = [
  'from-amber-50 to-white border-amber-200 [&_.tag]:bg-st-orange',
  'from-sky-50 to-white border-sky-200 [&_.tag]:bg-st-blue',
  'from-purple-50 to-white border-purple-200 [&_.tag]:bg-st-purple',
  'from-emerald-50 to-white border-emerald-200 [&_.tag]:bg-st-green',
  'from-rose-50 to-white border-rose-200 [&_.tag]:bg-st-red',
];
function Tips({ topic }) {
  if (!topic.tips.length) return <Card><Empty icon={Lightbulb} title="עדי עוד לא הוסיפה טיפים לנושא הזה" /></Card>;
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {topic.tips.map((t, i) => (
        <div key={t.id} className={cx('rounded-2xl border-2 bg-gradient-to-br p-5 shadow-[var(--shadow-card)] animate-rise', TIP_STYLES[i % TIP_STYLES.length])} style={{ animationDelay: `${i * 70}ms` }}>
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white shadow flex items-center justify-center text-2xl shrink-0">💡</div>
            <div className="flex-1">
              {t.tag && <span className="tag inline-block text-white text-[11px] font-black px-2.5 py-0.5 rounded-full mb-1.5">{t.tag}</span>}
              <h3 className="font-black text-lg leading-snug"><Rich text={t.title} /></h3>
              <p className="text-slate-700 leading-relaxed mt-2"><Rich text={t.content} /></p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Trophy, Target, BookOpen, Play, Medal, Lock, Sparkles, CheckCircle2, Zap, MessageCircle, Crown } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { Button, Card, Empty, PageLoader, ProgressBar, Ring, StatusPill, cx, topicColor, useUi, waLink, Chip } from '../ui/ui.jsx';
import { Rich } from '../lib/Rich.jsx';

const STATUS = {
  new: { label: 'טרם התחלת', color: 'grey' },
  progress: { label: 'בתהליך', color: 'orange' },
  done: { label: 'הושלם!', color: 'green' },
};

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Jerusalem' }).format(new Date()));
  if (h < 5) return 'לילה טוב';
  if (h < 12) return 'בוקר טוב';
  if (h < 17) return 'צהריים טובים';
  if (h < 21) return 'ערב טוב';
  return 'לילה טוב';
}

const MOTIVATION = [
  'כל תרגיל שפותרים היום – זה ציון גבוה יותר מחר 💪',
  'טעויות הן חלק מהלמידה. עוד ניסיון ואת/ה שם!',
  'עשר דקות תרגול ביום עושות את כל ההבדל.',
  'מוכנים לשבור שיא אישי חדש?',
  'מתמטיקה זה כמו שריר – ככה מחזקים אותה 🧠',
];

export default function Lobby() {
  const { user, settings } = useApp();
  const { toast } = useUi();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/api/me/dashboard').then(setData).catch((e) => toast(e.message, 'error'));
  }, [toast]);

  // Arrived through a topic invite link → jump straight into that topic.
  const { inviteTopic } = useApp();
  useEffect(() => {
    if (data && inviteTopic && data.topics.some((t) => t.id === inviteTopic)) navigate(`/topic/${inviteTopic}`, { replace: true });
  }, [data, inviteTopic, navigate]);

  const motivation = useMemo(() => MOTIVATION[new Date().getDate() % MOTIVATION.length], []);

  if (!data) return <PageLoader label="מכינים את הלובי שלך..." />;

  const li = user.levelInfo;
  const goal = user.dailyGoal || 60;
  const goalPct = Math.min(1, (user.todayXp || 0) / goal);
  const continueTopic = data.topics.find((t) => t.status === 'progress') || data.topics.find((t) => t.status === 'new') || data.topics[0];
  const earned = new Set(data.badges.map((b) => b.id));
  const maxDay = Math.max(20, ...data.week.map((d) => d.xp));
  const accuracy = data.stats.answers ? Math.round((data.stats.correct / data.stats.answers) * 100) : null;
  const dayNames = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

  return (
    <div className="space-y-6 animate-rise">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-navy-900 text-white p-6 sm:p-8 shadow-[var(--shadow-pop)]">
        <div className="absolute -left-10 -top-16 w-64 h-64 rounded-full bg-gold-500/20 blur-2xl" />
        <div className="absolute left-24 -bottom-20 w-72 h-72 rounded-full bg-st-blue/25 blur-3xl" />
        <div className="absolute left-6 top-6 text-7xl opacity-15 font-black select-none hidden sm:block">∑ π √</div>
        <div className="relative grid lg:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <p className="text-gold-300 font-bold">{greeting()},</p>
            <h1 className="text-3xl sm:text-4xl font-black mt-1">{user.name.split(' ')[0]} {user.avatar || '👋'}</h1>
            <p className="text-white/75 mt-2 text-[15px]">{motivation}</p>
            <div className="mt-5 max-w-md">
              <div className="flex justify-between text-sm font-bold mb-1.5">
                <span>{li.emoji} רמה {li.level} · {li.name}</span>
                <span className="text-gold-300">{li.next ? `${li.next - user.xp} XP לרמה הבאה` : 'רמה מקסימלית!'}</span>
              </div>
              <ProgressBar value={li.progress} color="bg-gradient-to-l from-gold-300 to-gold-500" height="h-3" className="!bg-white/15" />
            </div>
            {continueTopic && (
              <Button variant="gold" size="lg" icon={Play} className="mt-6" onClick={() => navigate(`/topic/${continueTopic.id}`)}>
                {continueTopic.status === 'new' ? 'מתחילים ללמוד' : 'ממשיכים מאיפה שעצרנו'}
              </Button>
            )}
          </div>
          <div className="flex gap-3 sm:gap-4">
            <div className="bg-white/10 rounded-2xl p-4 text-center min-w-28 backdrop-blur">
              <Ring value={goalPct} size={78} stroke={8} color="#00C875" track="rgba(255,255,255,.15)">
                <div className="leading-none"><div className="text-lg font-black">{user.todayXp || 0}</div><div className="text-[10px] text-white/60">/{goal}</div></div>
              </Ring>
              <div className="text-xs font-bold mt-2">{goalPct >= 1 ? 'היעד הושג! 🎯' : 'יעד יומי'}</div>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 text-center min-w-28 backdrop-blur flex flex-col items-center justify-center">
              <Flame size={44} className={cx(user.streak > 0 ? 'text-orange-400 fill-orange-400 animate-[float_2.5s_ease-in-out_infinite]' : 'text-white/30')} />
              <div className="text-2xl font-black mt-1">{user.streak}</div>
              <div className="text-xs font-bold">{user.streak === 1 ? 'יום ברצף' : 'ימים ברצף'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* Topics */}
        <section>
          <div className="flex items-end justify-between mb-3">
            <h2 className="text-xl font-black flex items-center gap-2"><BookOpen className="text-st-blue" /> הנושאים שלי</h2>
            <span className="text-sm text-slate-500 font-semibold">{data.topics.filter((t) => t.status === 'done').length}/{data.topics.length} הושלמו</span>
          </div>
          {data.topics.length === 0 ? (
            <Card><Empty icon={Lock} title="עדיין אין נושאים פתוחים" action={
              <a href={waLink(settings.whatsappPhone, `היי עדי, זה ${user.name}. עוד לא נפתחו לי נושאים בלומדה 🙂`)} target="_blank" rel="noreferrer">
                <Button variant="green" icon={MessageCircle}>לכתוב לעדי</Button>
              </a>}>עדי תפתח לך נושאים בקרוב. אפשר גם לשלוח לה הודעה.</Empty></Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {data.topics.map((t, i) => {
                const c = topicColor(t, i);
                const st = STATUS[t.status];
                return (
                  <button key={t.id} onClick={() => navigate(`/topic/${t.id}`)}
                    className="group text-right bg-white rounded-2xl border border-line shadow-[var(--shadow-card)] overflow-hidden hover:-translate-y-1 hover:shadow-[var(--shadow-pop)] transition-all duration-300 cursor-pointer animate-rise"
                    style={{ animationDelay: `${i * 60}ms` }}>
                    <div className={cx('h-24 bg-gradient-to-l p-4 relative overflow-hidden', c.bg)}>
                      <div className="absolute -left-4 -bottom-6 text-8xl font-black text-white/15 select-none group-hover:scale-110 transition-transform">∑</div>
                      <div className="flex items-start justify-between gap-2 relative">
                        <span className="text-white/90 text-xs font-bold bg-white/20 px-2 py-1 rounded-lg">{t.grade}{t.level ? ` · ${t.level}` : ''}</span>
                        {t.badge && <span className="bg-white text-navy-900 text-[11px] font-black px-2 py-1 rounded-lg shadow">{t.badge}</span>}
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-black text-lg leading-tight"><Rich text={t.title} /></h3>
                      <p className="text-sm text-slate-500 mt-1 line-clamp-2 min-h-10"><Rich text={t.description} /></p>
                      <div className="flex items-center justify-between mt-3 gap-2">
                        <StatusPill color={st.color}>{t.status === 'done' && <CheckCircle2 size={14} className="ml-1" />}{st.label}</StatusPill>
                        {t.bestExam !== null && <Chip color={t.bestExam >= 85 ? 'green' : t.bestExam >= 65 ? 'gold' : 'red'}><Trophy size={12} /> שיא במבחן: {t.bestExam}</Chip>}
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs font-bold text-slate-500 mb-1"><span>תרגילים שנפתרו</span><span>{t.solved}/{t.total}</span></div>
                        <ProgressBar value={t.total ? t.solved / t.total : 0} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Badges */}
          <div className="mt-8">
            <h2 className="text-xl font-black flex items-center gap-2 mb-3"><Medal className="text-st-purple" /> אוסף התגים <span className="text-sm font-bold text-slate-400">{earned.size}/{data.allBadges.length}</span></h2>
            <Card className="p-4">
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
                {data.allBadges.map((b) => {
                  const has = earned.has(b.id);
                  return (
                    <div key={b.id} title={`${b.name} – ${b.desc}`} className="flex flex-col items-center text-center gap-1">
                      <div className={cx('w-14 h-14 rounded-2xl flex items-center justify-center text-3xl transition', has ? 'bg-gradient-to-br from-gold-200 to-gold-400 shadow-[var(--shadow-glow)]' : 'bg-slate-100 grayscale opacity-40')}>
                        {has ? b.emoji : <Lock size={20} className="text-slate-400" />}
                      </div>
                      <span className={cx('text-[11px] font-bold leading-tight', has ? 'text-navy-900' : 'text-slate-400')}>{b.name}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </section>

        {/* Sidebar */}
        <aside className="space-y-5">
          <Card className="p-5">
            <h3 className="font-black flex items-center gap-2"><Zap className="text-st-orange" size={20} /> השבוע שלי</h3>
            <div className="flex items-end justify-between gap-2 h-32 mt-4">
              {data.week.map((d, idx) => {
                const isToday = idx === data.week.length - 1;
                const dow = new Date(d.day + 'T12:00:00').getDay();
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="text-[10px] font-bold text-slate-400">{d.xp || ''}</span>
                    <div className={cx('w-full rounded-lg transition-all duration-700', d.xp ? (isToday ? 'bg-gradient-to-t from-gold-500 to-gold-300' : 'bg-st-blue') : 'bg-slate-100')}
                      style={{ height: `${Math.max(6, (d.xp / maxDay) * 100)}%` }} />
                    <span className={cx('text-xs font-bold', isToday ? 'text-navy-900' : 'text-slate-400')}>{dayNames[dow]}</span>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="bg-slate-50 rounded-xl p-2"><div className="font-black text-lg">{data.stats.solved}</div><div className="text-[11px] text-slate-500 font-bold">נפתרו</div></div>
              <div className="bg-slate-50 rounded-xl p-2"><div className="font-black text-lg">{accuracy ?? '—'}{accuracy !== null && '%'}</div><div className="text-[11px] text-slate-500 font-bold">דיוק</div></div>
              <div className="bg-slate-50 rounded-xl p-2"><div className="font-black text-lg">{user.bestStreak ?? user.streak}</div><div className="text-[11px] text-slate-500 font-bold">שיא רצף</div></div>
            </div>
          </Card>

          {data.leaderboard && (
            <Card className="p-5">
              <h3 className="font-black flex items-center gap-2"><Crown className="text-gold-500" size={20} /> טבלת האלופים השבועית</h3>
              {data.leaderboard.top.length === 0 ? (
                <p className="text-sm text-slate-500 mt-3">השבוע רק התחיל – פתרו תרגיל ותופיעו ראשונים! 🚀</p>
              ) : (
                <ol className="mt-3 space-y-1.5">
                  {data.leaderboard.top.map((r) => (
                    <li key={r.rank} className={cx('flex items-center gap-3 px-3 h-11 rounded-xl', r.me ? 'bg-gold-200/70 ring-2 ring-gold-400' : 'bg-slate-50')}>
                      <span className={cx('w-7 text-center font-black', r.rank === 1 ? 'text-gold-500 text-lg' : r.rank <= 3 ? 'text-navy-700' : 'text-slate-400')}>
                        {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank}
                      </span>
                      <span className="text-lg">{r.avatar || '🙂'}</span>
                      <span className="flex-1 font-bold truncate">{r.name}{r.me && ' (את/ה)'}</span>
                      <span className="font-black text-sm text-navy-700">{r.xp} XP</span>
                    </li>
                  ))}
                </ol>
              )}
              {data.leaderboard.myRank > 10 && <p className="text-xs text-slate-500 mt-2 font-bold">המקום שלך: {data.leaderboard.myRank} ({data.leaderboard.myXp} XP)</p>}
            </Card>
          )}

          <Card className="p-5 bg-gradient-to-br from-white to-emerald-50/50">
            <h3 className="font-black flex items-center gap-2"><Target className="text-st-green" size={20} /> טיפ מעדי</h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">נתקעתם בשאלה? בכל תרגיל יש כפתור <b>"עדי, נתקעתי!"</b> ששולח לי את השאלה ישר לוואטסאפ.</p>
            <a href={waLink(settings.whatsappPhone, `היי עדי, זה ${user.name} מהלומדה 🙂`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-3 text-sm font-bold text-emerald-700 hover:underline">
              <MessageCircle size={16} /> לשלוח הודעה לעדי
            </a>
          </Card>
          {data.recentExams.length > 0 && (
            <Card className="p-5">
              <h3 className="font-black flex items-center gap-2"><Sparkles className="text-st-purple" size={20} /> מבחנים אחרונים</h3>
              <ul className="mt-3 space-y-2">
                {data.recentExams.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-semibold"><Rich text={r.exam_title} /></span>
                    <StatusPill color={r.score >= 85 ? 'green' : r.score >= 65 ? 'orange' : 'red'}>{r.score}</StatusPill>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

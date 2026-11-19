import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { Flame, Volume2, VolumeX, LogOut, KeyRound, Star, ChevronDown, ArrowRight, Eye } from 'lucide-react';
import { useApp } from '../App.jsx';
import { api } from '../lib/api.js';
import { Button, Field, Logo, Modal, Ring, cx, useUi } from '../ui/ui.jsx';
import { sfx, setSound, isSoundOn, burst, bigCelebration } from '../lib/fx.js';
import { PasswordInput } from '../pages/AuthPage.jsx';
import Lobby from './Lobby.jsx';
import TopicView from './TopicView.jsx';

const GameCtx = createContext(null);
export const useGame = () => useContext(GameCtx);

export const AVATARS = ['🦊', '🐼', '🦁', '🐯', '🐸', '🐙', '🦄', '🐧', '🐨', '🐵', '🦉', '🐬', '🚀', '⚡', '🌟', '🎧'];

function XpFloat({ items }) {
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[70] pointer-events-none">
      {items.map((x) => (
        <div key={x.id} dir="ltr" className="xp-float absolute -translate-x-1/2 whitespace-nowrap bg-gold-400 text-navy-950 font-black px-3 py-1 rounded-full shadow-[var(--shadow-glow)] text-sm">
          +{x.amount} XP
        </div>
      ))}
    </div>
  );
}

function UserMenu({ preview }) {
  const { user, logout, patchUser } = useApp();
  const { toast } = useUi();
  const [open, setOpen] = useState(false);
  const [sound, setSoundState] = useState(isSoundOn());
  const [pwOpen, setPwOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '' });
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const savePw = async (e) => {
    e.preventDefault();
    try {
      await api.put('/api/me/password', pw);
      toast('הסיסמה עודכנה', 'success');
      setPwOpen(false);
      setPw({ current: '', next: '' });
    } catch (err) { toast(err.message, 'error'); }
  };

  const pickAvatar = async (a) => {
    try {
      const { user: u } = await api.patch('/api/me', { avatar: a });
      patchUser({ avatar: u.avatar });
      setAvatarOpen(false);
      sfx.click();
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="btn-press flex items-center gap-2 h-10 pr-1 pl-2 rounded-xl hover:bg-slate-100 cursor-pointer">
        <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-gold-300 to-gold-500 flex items-center justify-center text-lg">{user.avatar || user.name.slice(0, 1)}</span>
        <span className="hidden sm:block font-bold text-sm max-w-28 truncate">{user.name.split(' ')[0]}</span>
        <ChevronDown size={15} className="text-slate-400" />
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-56 bg-white rounded-2xl border border-line shadow-[var(--shadow-pop)] p-1.5 z-40 animate-pop">
          {!preview && <MenuItem icon={Star} onClick={() => { setAvatarOpen(true); setOpen(false); }}>בחירת דמות</MenuItem>}
          <MenuItem icon={sound ? Volume2 : VolumeX} onClick={() => { setSound(!sound); setSoundState(!sound); }}>
            {sound ? 'השתקת צלילים' : 'הפעלת צלילים'}
          </MenuItem>
          {!preview && <MenuItem icon={KeyRound} onClick={() => { setPwOpen(true); setOpen(false); }}>שינוי סיסמה</MenuItem>}
          <div className="h-px bg-line my-1" />
          <MenuItem icon={LogOut} danger onClick={logout}>יציאה</MenuItem>
        </div>
      )}
      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="שינוי סיסמה" icon={KeyRound} size="sm">
        <form onSubmit={savePw} className="space-y-3">
          <Field label="סיסמה נוכחית"><PasswordInput value={pw.current} onChange={(v) => setPw({ ...pw, current: v })} /></Field>
          <Field label="סיסמה חדשה"><PasswordInput value={pw.next} onChange={(v) => setPw({ ...pw, next: v })} autoComplete="new-password" /></Field>
          <Button type="submit" className="w-full">שמירה</Button>
        </form>
      </Modal>
      <Modal open={avatarOpen} onClose={() => setAvatarOpen(false)} title="בחרו דמות" icon={Star} size="sm">
        <div className="grid grid-cols-4 gap-2">
          {AVATARS.map((a) => (
            <button key={a} onClick={() => pickAvatar(a)}
              className={cx('btn-press text-3xl h-16 rounded-2xl border-2 cursor-pointer hover:border-gold-400', user.avatar === a ? 'border-gold-500 bg-gold-200' : 'border-line')}>{a}</button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function MenuItem({ icon: Icon, children, danger, onClick }) {
  return (
    <button onClick={onClick} className={cx('w-full flex items-center gap-2.5 px-3 h-10 rounded-xl text-sm font-semibold cursor-pointer', danger ? 'text-rose-600 hover:bg-rose-50' : 'text-navy-900 hover:bg-slate-100')}>
      <Icon size={17} />{children}
    </button>
  );
}

function TopBar({ preview }) {
  const { user } = useApp();
  const navigate = useNavigate();
  const li = user.levelInfo;
  const goal = user.dailyGoal || 60;
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-line">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 h-16 flex items-center gap-2 sm:gap-3">
        <Link to={preview ? '/admin/content' : '/'} className="shrink-0"><Logo className="h-11" /></Link>
        {preview ? (
          <div className="flex-1 flex items-center gap-2 justify-center">
            <span className="bg-st-purple text-white text-xs font-black px-3 py-1.5 rounded-full flex items-center gap-1.5"><Eye size={14} /> תצוגה מקדימה כתלמיד</span>
            <Button size="sm" variant="soft" icon={ArrowRight} onClick={() => navigate(-1)}>חזרה לניהול</Button>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-end gap-1.5 sm:gap-2.5">
            <div title={`רצף של ${user.streak} ימים`} className={cx('flex items-center gap-1 h-10 px-2.5 rounded-xl font-black', user.streak > 0 ? 'text-orange-600 bg-orange-50' : 'text-slate-400 bg-slate-50')}>
              <Flame size={20} className={user.streak > 0 ? 'fill-orange-400' : ''} />{user.streak}
            </div>
            <div title="היעד היומי" className="flex items-center gap-1.5 h-10 pl-2.5 pr-1 rounded-xl bg-emerald-50">
              <Ring value={(user.todayXp || 0) / goal} size={32} stroke={4.5} color="#00C875" track="#d1f5e4">
                <span className="text-[10px] font-black text-emerald-700">{Math.min(99, Math.round(((user.todayXp || 0) / goal) * 100))}</span>
              </Ring>
              <span className="hidden md:block text-xs font-bold text-emerald-800">יעד יומי</span>
            </div>
            <div title={`רמה ${li?.level}: ${li?.name}`} className="flex items-center gap-1.5 h-10 px-2.5 rounded-xl bg-gold-200/70 text-gold-600 font-black">
              <span className="text-base">{li?.emoji}</span>
              <span className="text-sm text-navy-900">{user.xp}</span>
              <span className="text-[11px] hidden sm:inline">XP</span>
            </div>
          </div>
        )}
        <UserMenu preview={preview} />
      </div>
    </header>
  );
}

export default function StudentShell({ preview = false }) {
  const { patchUser } = useApp();
  const [floats, setFloats] = useState([]);
  const [levelUp, setLevelUp] = useState(null);
  const [badgeQueue, setBadgeQueue] = useState([]);
  const fid = useRef(0);

  const celebrate = useCallback((game) => {
    if (!game) return;
    patchUser({ xp: game.xp, streak: game.streak, todayXp: game.todayXp, levelInfo: game.level, dailyGoal: game.dailyGoal });
    if (game.xpGained > 0) {
      const id = ++fid.current;
      setFloats((f) => [...f, { id, amount: game.xpGained }]);
      setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1200);
    }
    if (game.levelUp) {
      setTimeout(() => { sfx.levelUp(); bigCelebration(); setLevelUp(game.level); }, 500);
    }
    if (game.newBadges?.length) setTimeout(() => { setBadgeQueue((q) => [...q, ...game.newBadges]); sfx.badge(); burst({ particleCount: 60 }); }, game.levelUp ? 1400 : 600);
  }, [patchUser]);

  const badge = badgeQueue[0];

  return (
    <GameCtx.Provider value={{ celebrate, preview }}>
      <div className="min-h-screen flex flex-col">
        <TopBar preview={preview} />
        <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-4 py-5 sm:py-8">
          {preview ? <TopicView preview /> : (
            <Routes>
              <Route index element={<Lobby />} />
              <Route path="topic/:topicId/*" element={<TopicView />} />
              <Route path="*" element={<Lobby />} />
            </Routes>
          )}
        </main>
      </div>
      <XpFloat items={floats} />

      <Modal open={!!levelUp && !badge} onClose={() => setLevelUp(null)} size="sm">
        <div className="text-center py-2">
          <div className="text-7xl animate-bounce-in">{levelUp?.emoji}</div>
          <div className="text-sm font-black text-gold-600 mt-3">עלית רמה!</div>
          <h2 className="text-3xl font-black mt-1">רמה {levelUp?.level}</h2>
          <p className="text-lg font-bold text-navy-700">{levelUp?.name}</p>
          <Button variant="gold" size="lg" className="mt-6 w-full" onClick={() => setLevelUp(null)}>מדהים, ממשיכים!</Button>
        </div>
      </Modal>

      <Modal open={!!badge} onClose={() => setBadgeQueue((q) => q.slice(1))} size="sm">
        <div className="text-center py-2">
          <div className="mx-auto w-28 h-28 rounded-full gold-shine flex items-center justify-center text-6xl shadow-[var(--shadow-glow)] animate-bounce-in">{badge?.emoji}</div>
          <div className="text-sm font-black text-gold-600 mt-4">תג חדש נפתח!</div>
          <h2 className="text-2xl font-black mt-1">{badge?.name}</h2>
          <p className="text-slate-600">{badge?.desc}</p>
          <Button size="lg" className="mt-6 w-full" onClick={() => setBadgeQueue((q) => q.slice(1))}>יש!</Button>
        </div>
      </Modal>
    </GameCtx.Provider>
  );
}

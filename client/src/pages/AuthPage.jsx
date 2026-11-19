import { useState } from 'react';
import { Sparkles, LogIn, UserPlus, Eye, EyeOff, Flame, Trophy, Target, Brain, MessageCircle } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { Button, Field, Logo, useUi, cx, waLink } from '../ui/ui.jsx';
import { Rich } from '../lib/Rich.jsx';
import { sfx } from '../lib/fx.js';

export function PasswordInput({ value, onChange, placeholder, autoComplete = 'current-password' }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input className="field pl-11" dir="ltr" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} autoComplete={autoComplete} required />
      <button type="button" onClick={() => setShow(!show)} className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-navy-900 cursor-pointer" aria-label="הצג סיסמה">
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export function AuthLayout({ children, side }) {
  const { settings } = useApp();
  return (
    <div className="min-h-screen dot-grid flex flex-col">
      <header className="max-w-6xl w-full mx-auto px-4 pt-5 flex items-center justify-between">
        <div className="bg-white rounded-2xl px-3 py-1.5 border border-line shadow-[var(--shadow-card)]"><Logo className="h-12" /></div>
        <a href={waLink(settings.whatsappPhone, 'היי עדי, יש לי שאלה לגבי הלומדה')} target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 text-sm font-bold text-emerald-700 bg-white border border-line rounded-xl px-3 h-10 hover:bg-emerald-50">
          <MessageCircle size={17} /> <span className="hidden sm:inline">דברו עם עדי</span>
        </a>
      </header>
      {side ? (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 lg:py-12 grid lg:grid-cols-2 gap-10 items-center">
          <div className="order-2 lg:order-1">{side}</div>
          <div className="order-1 lg:order-2">{children}</div>
        </main>
      ) : (
        <main className="flex-1 w-full px-4 py-10 flex items-center justify-center">{children}</main>
      )}
      <footer className="text-center text-xs text-slate-500 pb-5">
        © עדי – בית למתמטיקה {settings.brandSubtitle ? `| ${settings.brandSubtitle}` : ''}
        {settings.homeUrl && <> · <a className="font-bold text-navy-800 hover:text-gold-600" href={settings.homeUrl} target="_blank" rel="noreferrer">לאתר הבית</a></>}
      </footer>
    </div>
  );
}

function Hero() {
  const { invite } = useApp();
  const features = [
    { icon: Brain, color: 'bg-st-blue', title: 'הסברים שמבינים', text: 'שלב אחרי שלב, בגובה העיניים' },
    { icon: Target, color: 'bg-st-green', title: 'תרגול חכם', text: 'רמזים, הסברים ומשוב מיידי' },
    { icon: Flame, color: 'bg-st-orange', title: 'רצף ונקודות', text: 'צוברים XP ושוברים שיאים' },
    { icon: Trophy, color: 'bg-st-purple', title: 'מבחני סימולציה', text: 'מגיעים מוכנים למבחן' },
  ];
  return (
    <div className="space-y-6 animate-rise">
      {invite && (
        <div className="bg-gradient-to-l from-gold-200 to-white border-2 border-gold-400 rounded-2xl p-4 flex items-center gap-3.5 shadow-[var(--shadow-card)]">
          <div className="w-12 h-12 rounded-2xl bg-navy-900 text-gold-400 flex items-center justify-center shrink-0"><Sparkles size={24} /></div>
          <div>
            <div className="text-xs font-black text-gold-600">הוזמנת ללמוד בלומדה!</div>
            <div className="text-lg font-black text-navy-900"><Rich text={invite.title} /> {invite.grade && <span className="text-slate-500 font-bold text-base">· {invite.grade}</span>}</div>
            <div className="text-sm text-slate-600">הירשמו או התחברו כדי להתחיל</div>
          </div>
        </div>
      )}
      <div className="inline-flex items-center gap-2 bg-navy-900 text-gold-300 px-3.5 py-1.5 rounded-full text-xs font-extrabold">
        <Sparkles size={14} /> סביבת הלמידה האישית של תלמידי עדי
      </div>
      <h1 className="text-4xl sm:text-5xl font-black leading-[1.15] text-navy-900">
        מתמטיקה שמבינים
        <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-l from-[#0073ea] via-st-purple to-gold-500">ושכיף לתרגל.</span>
      </h1>
      <p className="text-lg text-slate-600 leading-relaxed max-w-xl">
        הסברים ברורים, עשרות תרגילים אינטראקטיביים עם רמזים חכמים, הטיפים של עדי ומבחני סימולציה – הכל במקום אחד, מותאם בדיוק לכיתה שלך.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {features.map((f) => (
          <div key={f.title} className="bg-white rounded-2xl p-3.5 border border-line shadow-[var(--shadow-card)] flex items-start gap-3">
            <div className={cx('w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0', f.color)}><f.icon size={20} /></div>
            <div>
              <div className="font-extrabold text-[15px]">{f.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{f.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuthPage() {
  const { settings, setUser, invite } = useApp();
  const { toast } = useUi();
  const [tab, setTab] = useState(invite ? 'register' : 'login');
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({
    identifier: '', password: '', name: '', phone: '', email: '', regPassword: '',
    grade: invite?.grade || '', level: '', program: '',
  });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: typeof v === 'string' ? v : v.target.value }));

  const submitLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { user } = await api.post('/api/auth/login', { identifier: f.identifier, password: f.password });
      sfx.correct();
      toast(user.role === 'admin' ? `ברוכה הבאה, ${user.name}!` : `היי ${user.name.split(' ')[0]}, טוב לראות אותך!`, 'success');
      setUser(user);
    } catch (err) {
      sfx.wrong();
      toast(err.message, 'error');
    } finally { setLoading(false); }
  };

  const submitRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { user } = await api.post('/api/auth/register', {
        name: f.name, phone: f.phone, email: f.email, password: f.regPassword,
        grade: f.grade, level: f.level, program: f.program, requestedTopic: invite?.id || '',
      });
      sfx.correct();
      toast('ההרשמה נקלטה! עדי תאשר את הגישה בקרוב.', 'success');
      setUser(user);
    } catch (err) {
      sfx.wrong();
      toast(err.message, 'error');
    } finally { setLoading(false); }
  };

  return (
    <AuthLayout side={<Hero />}>
      <div className="bg-white rounded-3xl border border-line shadow-[var(--shadow-pop)] overflow-hidden animate-pop max-w-lg mx-auto w-full">
        <div className="grid grid-cols-2 bg-slate-100 p-1.5 m-4 mb-0 rounded-2xl">
          {[['login', 'התחברות', LogIn], ['register', 'הרשמה חדשה', UserPlus]].map(([id, label, I]) => (
            <button key={id} onClick={() => setTab(id)}
              className={cx('btn-press h-11 rounded-xl text-sm font-black flex items-center justify-center gap-2 cursor-pointer',
                tab === id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-navy-900')}>
              <I size={17} />{label}
            </button>
          ))}
        </div>

        {tab === 'login' ? (
          <form onSubmit={submitLogin} className="p-6 space-y-4">
            <Field label="אימייל או מספר טלפון">
              <input className="field" value={f.identifier} onChange={set('identifier')} placeholder="noa@gmail.com או 050-1234567" autoComplete="username" required />
            </Field>
            <Field label="סיסמה">
              <PasswordInput value={f.password} onChange={set('password')} placeholder="הסיסמה שלך" />
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={loading} icon={LogIn}>כניסה ללומדה</Button>
            <p className="text-center text-xs text-slate-500">
              שכחתם סיסמה? <a className="font-bold text-emerald-700" target="_blank" rel="noreferrer"
                href={waLink(settings.whatsappPhone, 'היי עדי, שכחתי את הסיסמה ללומדה. אפשר עזרה?')}>כתבו לעדי בוואטסאפ</a>
            </p>
          </form>
        ) : !settings.registrationOpen ? (
          <div className="p-8 text-center">
            <p className="font-bold text-navy-900">ההרשמה סגורה כרגע.</p>
            <p className="text-slate-500 text-sm mt-1">כדי לקבל גישה, פנו לעדי בוואטסאפ.</p>
            <a className="inline-block mt-4" href={waLink(settings.whatsappPhone, 'היי עדי, אשמח להצטרף ללומדה')} target="_blank" rel="noreferrer">
              <Button variant="green" icon={MessageCircle}>וואטסאפ לעדי</Button>
            </a>
          </div>
        ) : (
          <form onSubmit={submitRegister} className="p-6 space-y-3.5">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="שם מלא *"><input className="field" value={f.name} onChange={set('name')} placeholder="נועה כהן" autoComplete="name" required /></Field>
              <Field label="טלפון (תלמיד/הורה) *"><input className="field" dir="ltr" value={f.phone} onChange={set('phone')} placeholder="050-1234567" inputMode="tel" autoComplete="tel" required /></Field>
            </div>
            <Field label="אימייל *"><input className="field" dir="ltr" type="email" value={f.email} onChange={set('email')} placeholder="name@gmail.com" autoComplete="email" required /></Field>
            <Field label="בחירת סיסמה *" hint="לפחות 6 תווים"><PasswordInput value={f.regPassword} onChange={set('regPassword')} placeholder="סיסמה" autoComplete="new-password" /></Field>
            <div className="grid grid-cols-3 gap-2.5">
              <Field label="כיתה">
                <select className="field !px-2.5" value={f.grade} onChange={set('grade')} required>
                  <option value="">בחירה</option>
                  {settings.grades.map((g) => <option key={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="הקבצה">
                <select className="field !px-2.5" value={f.level} onChange={set('level')}>
                  <option value="">—</option>
                  {settings.levels.map((g) => <option key={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="מסגרת">
                <select className="field !px-2.5" value={f.program} onChange={set('program')}>
                  <option value="">—</option>
                  {settings.programs.map((g) => <option key={g}>{g}</option>)}
                </select>
              </Field>
            </div>
            <Button type="submit" variant="gold" size="lg" className="w-full !mt-5" loading={loading} icon={Sparkles}>יאללה, נרשמים!</Button>
            <p className="text-center text-xs text-slate-500">לאחר ההרשמה עדי תאשר את הגישה ותפתח לך את הנושאים.</p>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}

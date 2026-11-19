// Shared design-system components.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';

export const cx = (...a) => a.filter(Boolean).join(' ');

// ------------------------------------------------------------------ Logo
export function Logo({ className = 'h-11', withText = true }) {
  return (
    <svg viewBox={withText ? '0 0 260 222' : '0 0 260 175'} className={cx('w-auto block', className)} aria-label="עדי - בית למתמטיקה">
      <path d="M186 35 H211 V72 L186 55 Z" fill="#091E3A" />
      <path d="M18 92 L130 16 L242 92" fill="none" stroke="#091E3A" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M42 84 V156 Q42 163 49 163 H160" fill="none" stroke="#091E3A" strokeWidth="9" strokeLinecap="round" />
      <path d="M218 84 V156 Q218 163 211 163 H193" fill="none" stroke="#091E3A" strokeWidth="9" strokeLinecap="round" />
      <text x="130" y="64" fill="#C59B5F" fontFamily="Rubik, serif" fontWeight="800" fontSize="33" textAnchor="middle">Σ</text>
      <text x="92" y="95" fill="#C59B5F" fontFamily="Rubik, sans-serif" fontWeight="900" fontSize="27" textAnchor="middle">+</text>
      <text x="130" y="95" fill="#C59B5F" fontFamily="Rubik, sans-serif" fontWeight="900" fontSize="27" textAnchor="middle">=</text>
      <text x="168" y="95" fill="#C59B5F" fontFamily="Rubik, sans-serif" fontWeight="900" fontSize="27" textAnchor="middle">÷</text>
      <text x="130" y="148" fill="#091E3A" fontFamily="Rubik, sans-serif" fontWeight="900" fontSize="68" textAnchor="middle">עדי</text>
      {withText && <text x="130" y="206" fill="#091E3A" fontFamily="Rubik, sans-serif" fontWeight="900" fontSize="31" textAnchor="middle">בית למתמטיקה</text>}
    </svg>
  );
}

// ------------------------------------------------------------------ Button
const VARIANTS = {
  primary: 'bg-navy-900 text-white hover:bg-navy-800 shadow-sm',
  gold: 'bg-gradient-to-l from-gold-500 to-gold-400 text-navy-950 hover:brightness-105 shadow-[var(--shadow-glow)]',
  blue: 'bg-[#0073ea] text-white hover:bg-[#0060c2] shadow-sm',
  green: 'bg-st-green text-white hover:brightness-95 shadow-sm',
  soft: 'bg-white text-navy-900 border border-line hover:bg-slate-50',
  ghost: 'text-navy-800 hover:bg-slate-100',
  danger: 'bg-st-red text-white hover:brightness-95',
  dangerSoft: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200',
};
const SIZES = {
  xs: 'h-7 px-2.5 text-xs gap-1 rounded-lg',
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-5 text-[15px] gap-2 rounded-xl',
  lg: 'h-14 px-7 text-lg gap-2.5 rounded-2xl',
};

export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, className, children, ...rest }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx('btn-press inline-flex items-center justify-center font-bold whitespace-nowrap select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer', VARIANTS[variant], SIZES[size], className)}
    >
      {loading ? <Loader2 className="animate-spin" size={size === 'lg' ? 22 : 17} /> : Icon ? <Icon size={size === 'lg' ? 22 : size === 'xs' ? 14 : 17} strokeWidth={2.4} /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, className, size = 18, ...rest }) {
  return (
    <button {...rest} title={label} aria-label={label}
      className={cx('btn-press inline-flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:text-navy-900 hover:bg-slate-100 cursor-pointer disabled:opacity-40', className)}>
      <Icon size={size} strokeWidth={2.2} />
    </button>
  );
}

// ------------------------------------------------------------------ Card / misc
export function Card({ className, children, ...rest }) {
  return <div {...rest} className={cx('bg-white rounded-2xl border border-line shadow-[var(--shadow-card)]', className)}>{children}</div>;
}

export function Spinner({ className = '' }) {
  return <Loader2 className={cx('animate-spin text-navy-700', className)} size={28} />;
}

export function PageLoader({ label = 'טוען...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-28 gap-4 text-center">
      <div className="bg-white p-4 rounded-3xl shadow-[var(--shadow-card)] border border-line animate-[float_2.4s_ease-in-out_infinite]">
        <Logo className="h-14" withText={false} />
      </div>
      <p className="font-bold text-navy-800">{label}</p>
    </div>
  );
}

export function Empty({ icon: Icon = Info, title, children, action }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4"><Icon size={30} /></div>
      <h3 className="text-lg font-extrabold text-navy-900">{title}</h3>
      {children && <p className="text-slate-500 mt-1 max-w-md">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// monday-style colored status cell / pill
export const STATUS_COLORS = {
  green: 'bg-st-green', orange: 'bg-st-orange', red: 'bg-st-red', purple: 'bg-st-purple',
  blue: 'bg-st-blue', grey: 'bg-st-grey', pink: 'bg-st-pink', teal: 'bg-st-teal', navy: 'bg-navy-800', gold: 'bg-gold-500',
};
export function StatusPill({ color = 'grey', children, className, onClick, cell }) {
  return (
    <span onClick={onClick}
      className={cx('inline-flex items-center justify-center text-white font-bold text-[13px] select-none',
        cell ? 'w-full h-full min-h-9 px-2' : 'px-3 h-7 rounded-full',
        STATUS_COLORS[color] || color, onClick && 'cursor-pointer hover:brightness-95', className)}>
      {children}
    </span>
  );
}

export function Chip({ children, className, color = 'slate' }) {
  const colors = {
    slate: 'bg-slate-100 text-slate-700', gold: 'bg-gold-200 text-gold-600', blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700', red: 'bg-rose-50 text-rose-700', purple: 'bg-purple-50 text-purple-700', navy: 'bg-navy-900 text-gold-300',
  };
  return <span className={cx('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold', colors[color], className)}>{children}</span>;
}

export function ProgressBar({ value, className, color = 'bg-st-green', height = 'h-2.5' }) {
  return (
    <div className={cx('w-full bg-slate-100 rounded-full overflow-hidden', height, className)}>
      <div className={cx('h-full rounded-full transition-all duration-700', color)} style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 7, color = '#00C875', track = '#EEF1F6', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function Field({ label, hint, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="block text-[13px] font-bold text-navy-800 mb-1.5">{label}</span>}
      {children}
      {hint && <span className="block text-xs text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-3 cursor-pointer select-none">
      <span className={cx('relative w-11 h-6 rounded-full transition-colors', checked ? 'bg-st-green' : 'bg-slate-300')}>
        <span className={cx('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all', checked ? 'right-0.5' : 'right-[22px]')} />
      </span>
      {label && <span className="text-sm font-semibold text-navy-900">{label}</span>}
    </button>
  );
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cx('flex gap-1 bg-slate-100 p-1 rounded-2xl overflow-x-auto scroll-thin', className)}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={cx('btn-press flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold whitespace-nowrap cursor-pointer',
            value === t.id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-navy-900')}>
          {t.icon && <t.icon size={17} />}{t.label}
          {t.count !== undefined && <span className={cx('text-[11px] px-1.5 rounded-full', value === t.id ? 'bg-navy-900 text-white' : 'bg-slate-200 text-slate-600')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Modal
export function Modal({ open, onClose, title, subtitle, icon: Icon, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };
  // Portal to <body>: animated (transformed) ancestors would otherwise trap position:fixed.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 bg-navy-950/60 backdrop-blur-sm overflow-y-auto"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={cx('bg-white rounded-3xl w-full shadow-[var(--shadow-pop)] animate-pop my-auto flex flex-col max-h-[calc(100dvh-24px)]', widths[size])}>
        {(title || Icon) && (
          <div className="flex items-start gap-3 p-5 sm:p-6 pb-3 border-b border-line">
            {Icon && <div className="w-11 h-11 rounded-2xl bg-navy-900 text-gold-400 flex items-center justify-center shrink-0"><Icon size={22} /></div>}
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-black text-navy-900">{title}</h3>
              {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
            <IconButton icon={X} label="סגירה" onClick={onClose} />
          </div>
        )}
        <div className="p-5 sm:p-6 overflow-y-auto scroll-thin flex-1">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 p-4 sm:px-6 border-t border-line bg-slate-50/60 rounded-b-3xl">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ------------------------------------------------------------------ Toasts + confirm
const UiCtx = createContext(null);
export const useUi = () => useContext(UiCtx);

export function UiProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const idRef = useRef(0);

  const toast = useCallback((message, type = 'info') => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-3), { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'error' ? 5200 : 3400);
  }, []);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    setConfirmState({ ...opts, resolve });
  }), []);

  const icons = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };
  const colors = { success: 'bg-st-green', error: 'bg-st-red', warning: 'bg-st-orange', info: 'bg-navy-900' };

  return (
    <UiCtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 items-center pointer-events-none w-[calc(100%-32px)] max-w-md">
        {toasts.map((t) => {
          const I = icons[t.type] || Info;
          return (
            <div key={t.id} className={cx('pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl text-white font-bold text-sm shadow-[var(--shadow-pop)] animate-pop w-full', colors[t.type])}>
              <I size={20} className="shrink-0" /><span>{t.message}</span>
            </div>
          );
        })}
      </div>
      <Modal open={!!confirmState} onClose={() => { confirmState?.resolve(false); setConfirmState(null); }}
        title={confirmState?.title || 'בטוח?'} icon={confirmState?.danger ? AlertTriangle : Info} size="sm"
        footer={<>
          <Button variant="soft" onClick={() => { confirmState.resolve(false); setConfirmState(null); }}>ביטול</Button>
          <Button variant={confirmState?.danger ? 'danger' : 'primary'} onClick={() => { confirmState.resolve(true); setConfirmState(null); }}>
            {confirmState?.confirmText || 'אישור'}
          </Button>
        </>}>
        <p className="text-slate-600 leading-relaxed">{confirmState?.message}</p>
      </Modal>
    </UiCtx.Provider>
  );
}

// ------------------------------------------------------------------ helpers
export function timeAgo(ts) {
  if (!ts) return 'אף פעם';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'עכשיו';
  const m = Math.floor(s / 60);
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.floor(m / 60);
  if (h < 24) return `לפני ${h === 1 ? 'שעה' : h + ' שעות'}`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'אתמול';
  if (d < 30) return `לפני ${d} ימים`;
  return new Date(ts).toLocaleDateString('he-IL');
}

export function fmtDate(ts) {
  return ts ? new Date(ts).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
}

export function scoreColor(score) {
  if (score === null || score === undefined) return 'grey';
  if (score >= 85) return 'green';
  if (score >= 65) return 'orange';
  return 'red';
}

export const TOPIC_COLORS = {
  sky: { bg: 'from-sky-500 to-blue-600', soft: 'bg-sky-50', text: 'text-sky-700', dot: '#579BFC' },
  purple: { bg: 'from-purple-500 to-fuchsia-600', soft: 'bg-purple-50', text: 'text-purple-700', dot: '#A25DDC' },
  green: { bg: 'from-emerald-500 to-teal-600', soft: 'bg-emerald-50', text: 'text-emerald-700', dot: '#00C875' },
  orange: { bg: 'from-amber-400 to-orange-500', soft: 'bg-amber-50', text: 'text-amber-700', dot: '#FDAB3D' },
  pink: { bg: 'from-pink-500 to-rose-500', soft: 'bg-pink-50', text: 'text-pink-700', dot: '#FF5AC4' },
  navy: { bg: 'from-navy-700 to-navy-900', soft: 'bg-slate-100', text: 'text-navy-800', dot: '#1B4375' },
  teal: { bg: 'from-cyan-500 to-teal-600', soft: 'bg-cyan-50', text: 'text-cyan-700', dot: '#00A9B5' },
};
export function topicColor(t, i = 0) {
  const keys = Object.keys(TOPIC_COLORS);
  return TOPIC_COLORS[t?.color] || TOPIC_COLORS[keys[i % keys.length]];
}

export function waLink(phone, text) {
  const p = String(phone || '').replace(/\D/g, '').replace(/^0/, '972');
  return `https://wa.me/${p}?text=${encodeURIComponent(text || '')}`;
}

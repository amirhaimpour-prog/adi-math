// Interactive answer widgets shared by practice and exams.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, Delete, Keyboard, Check, X } from 'lucide-react';
import { Rich } from '../lib/Rich.jsx';
import { cx } from '../ui/ui.jsx';
import { sfx } from '../lib/fx.js';

const LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];

export function McqInput({ q, value, onChange, disabled, reveal }) {
  // reveal: { correct: string|null, wrong: string|null }
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {q.options.map((opt, i) => {
        const selected = value === opt;
        const isCorrect = reveal?.correct === opt;
        const isWrong = reveal?.wrong === opt;
        return (
          <button key={opt + i} type="button" disabled={disabled} onClick={() => { sfx.click(); onChange(opt); }}
            className={cx('btn-3d flex items-center gap-3 text-right p-4 rounded-2xl border-2 font-semibold text-[17px] cursor-pointer disabled:cursor-default min-h-16',
              isCorrect ? 'border-st-green bg-emerald-50' : isWrong ? 'border-st-red bg-rose-50 animate-shake' : selected ? 'border-st-blue bg-blue-50' : 'border-line bg-white hover:border-slate-300 hover:bg-slate-50')}>
            <span className={cx('w-9 h-9 rounded-xl flex items-center justify-center font-black shrink-0 text-sm',
              isCorrect ? 'bg-st-green text-white' : isWrong ? 'bg-st-red text-white' : selected ? 'bg-st-blue text-white' : 'bg-slate-100 text-slate-500')}>
              {isCorrect ? <Check size={18} /> : isWrong ? <X size={18} /> : LETTERS[i]}
            </span>
            <Rich text={opt} className="flex-1" />
          </button>
        );
      })}
    </div>
  );
}

export function TrueFalseInput({ value, onChange, disabled, reveal }) {
  const opts = [['true', 'נכון', '👍'], ['false', 'לא נכון', '👎']];
  return (
    <div className="grid grid-cols-2 gap-3 max-w-lg">
      {opts.map(([v, label, emoji]) => {
        const isCorrect = reveal?.correct === v;
        const isWrong = reveal?.wrong === v;
        return (
          <button key={v} type="button" disabled={disabled} onClick={() => { sfx.click(); onChange(v); }}
            className={cx('btn-3d h-20 rounded-2xl border-2 text-xl font-black flex items-center justify-center gap-2 cursor-pointer disabled:cursor-default',
              isCorrect ? 'border-st-green bg-emerald-50 text-emerald-700' : isWrong ? 'border-st-red bg-rose-50 text-rose-700 animate-shake'
                : value === v ? 'border-st-blue bg-blue-50 text-blue-800' : 'border-line bg-white hover:bg-slate-50')}>
            <span className="text-2xl">{emoji}</span>{label}
          </button>
        );
      })}
    </div>
  );
}

const KEYS = ['-', '+', '/', '.', '(', ')', '^', 'x', '√', 'π'];
export function MathTextInput({ value, onChange, disabled, onEnter, unit, status, autoFocus = true }) {
  const [pad, setPad] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!autoFocus) return undefined;
    const t = setTimeout(() => ref.current?.focus({ preventScroll: true }), 60);
    return () => clearTimeout(t);
  }, [autoFocus]);
  const insert = (k) => { sfx.click(); onChange((value || '') + k); ref.current?.focus({ preventScroll: true }); };
  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-2">
        <input ref={ref} dir="ltr" disabled={disabled} value={value || ''} onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onEnter?.()} placeholder="התשובה שלך..." inputMode="text" autoComplete="off"
          className={cx('field !h-16 !text-2xl !font-black text-center tracking-wide !rounded-2xl',
            status === 'correct' && '!border-st-green !bg-emerald-50', status === 'wrong' && '!border-st-red !bg-rose-50 animate-shake')} />
        {unit && <span className="font-bold text-slate-500">{unit}</span>}
        <button type="button" onClick={() => setPad(!pad)} title="מקלדת מתמטית"
          className={cx('btn-press w-14 h-16 rounded-2xl border-2 flex items-center justify-center shrink-0 cursor-pointer', pad ? 'border-st-blue text-st-blue bg-blue-50' : 'border-line text-slate-500 bg-white')}>
          <Keyboard size={24} />
        </button>
      </div>
      {pad && !disabled && (
        <div dir="ltr" className="grid grid-cols-6 gap-1.5 mt-2 animate-pop">
          {KEYS.map((k) => (
            <button key={k} type="button" onClick={() => insert(k)} className="btn-3d h-11 rounded-xl bg-white border border-line font-black text-lg hover:bg-slate-50 cursor-pointer">{k}</button>
          ))}
          <button type="button" onClick={() => onChange((value || '').slice(0, -1))} className="btn-3d h-11 rounded-xl bg-slate-100 border border-line flex items-center justify-center cursor-pointer"><Delete size={18} /></button>
          <button type="button" onClick={() => onChange('')} className="btn-3d h-11 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 font-bold text-sm cursor-pointer">נקה</button>
        </div>
      )}
      <p className="text-xs text-slate-400 mt-2">אפשר לכתוב שבר כך: 3/4 · מספר שלילי: ‎-5 · חזקה: x^2</p>
    </div>
  );
}

export function NumberLineInput({ q, value, onChange, disabled, correctValue, status }) {
  const ticks = useMemo(() => {
    const a = [];
    for (let n = q.min; n <= q.max; n++) a.push(n);
    return a;
  }, [q.min, q.max]);
  const pos = (n) => ((n - q.min) / (q.max - q.min)) * 100;
  const sel = value === '' || value === undefined || value === null ? null : Number(value);
  return (
    <div dir="ltr" className="bg-gradient-to-b from-sky-50 to-white rounded-2xl border border-sky-100 px-5 sm:px-10 pt-14 pb-4 select-none touch-manipulation">
      <div className="relative h-16">
        <div className="absolute top-6 left-0 right-0 h-1.5 bg-navy-800 rounded-full" />
        <div className="absolute top-[18px] -left-3 text-navy-800 text-xl font-black">◀</div>
        <div className="absolute top-[18px] -right-3 text-navy-800 text-xl font-black">▶</div>
        {ticks.map((n) => {
          const isSel = sel === n;
          const isCorrect = correctValue === n;
          return (
            <button key={n} type="button" disabled={disabled} onClick={() => { sfx.click(); onChange(String(n)); }}
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center group cursor-pointer disabled:cursor-default" style={{ left: `${pos(n)}%`, width: 28 }}>
              <span className={cx('w-1 rounded-full mt-3', n === 0 ? 'h-8 bg-navy-900' : 'h-6 bg-navy-700', 'group-hover:bg-st-blue')} />
              <span className={cx('text-xs sm:text-sm font-bold mt-1', n === 0 ? 'text-navy-900 font-black' : 'text-slate-600', ticks.length > 12 && n % 2 !== 0 && 'max-sm:opacity-0', ticks.length > 24 && n % 2 !== 0 && 'opacity-0')}>{n}</span>
              {(isSel || isCorrect) && (
                <span className={cx('absolute -top-9 w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm shadow-lg animate-bounce-in',
                  isCorrect ? 'bg-st-green' : status === 'wrong' ? 'bg-st-red' : status === 'correct' ? 'bg-st-green' : 'bg-st-blue')}>
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p dir="rtl" className="text-center text-xs text-slate-500 mt-2">לחצו על הנקודה הנכונה בציר</p>
    </div>
  );
}

export function OrderInput({ value, onChange, disabled, status }) {
  const items = value || [];
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    sfx.click();
    onChange(next);
  };
  return (
    <ol className="space-y-2 max-w-xl">
      {items.map((it, i) => (
        <li key={it} className={cx('flex items-center gap-3 bg-white border-2 rounded-2xl p-2 pr-3 transition-all',
          status === 'correct' ? 'border-st-green' : status === 'wrong' ? 'border-st-red' : 'border-line')}>
          <span className="w-8 h-8 rounded-xl bg-navy-900 text-white font-black flex items-center justify-center text-sm shrink-0">{i + 1}</span>
          <Rich text={it} className="flex-1 font-semibold text-lg" />
          <div className="flex gap-1">
            <button type="button" disabled={disabled || i === 0} onClick={() => move(i, -1)} className="btn-press w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center disabled:opacity-30 cursor-pointer" aria-label="למעלה"><ChevronUp size={20} /></button>
            <button type="button" disabled={disabled || i === items.length - 1} onClick={() => move(i, 1)} className="btn-press w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center disabled:opacity-30 cursor-pointer" aria-label="למטה"><ChevronDown size={20} /></button>
          </div>
        </li>
      ))}
    </ol>
  );
}

const PAIR_COLORS = ['bg-st-blue', 'bg-st-purple', 'bg-st-orange', 'bg-st-teal', 'bg-st-pink', 'bg-navy-700'];
export function MatchInput({ q, value, onChange, disabled, status }) {
  // value: array (aligned with q.left) of chosen right strings (or null)
  const pairs = value || q.left.map(() => null);
  const [activeLeft, setActiveLeft] = useState(null);
  const rightOwner = (r) => pairs.findIndex((p) => p === r);

  const pickLeft = (i) => { if (!disabled) { sfx.click(); setActiveLeft(i === activeLeft ? null : i); } };
  const pickRight = (r) => {
    if (disabled) return;
    const target = activeLeft ?? pairs.findIndex((p) => p === null);
    if (target < 0) return;
    sfx.click();
    const next = pairs.map((p) => (p === r ? null : p));
    next[target] = r;
    onChange(next);
    setActiveLeft(null);
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-6 max-w-2xl">
      <div className="space-y-2">
        {q.left.map((l, i) => (
          <button key={i} type="button" onClick={() => pickLeft(i)}
            className={cx('btn-press w-full flex items-center gap-2 p-3 rounded-2xl border-2 bg-white text-right min-h-14 cursor-pointer',
              activeLeft === i ? 'border-st-blue ring-4 ring-blue-100' : 'border-line',
              status === 'correct' && '!border-st-green', status === 'wrong' && '!border-st-red')}>
            <span className={cx('w-3 h-3 rounded-full shrink-0', pairs[i] !== null ? PAIR_COLORS[i % PAIR_COLORS.length] : 'bg-slate-200')} />
            <Rich text={l} className="flex-1 font-semibold" />
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {q.right.map((r) => {
          const owner = rightOwner(r);
          return (
            <button key={r} type="button" onClick={() => pickRight(r)}
              className={cx('btn-press w-full flex items-center gap-2 p-3 rounded-2xl border-2 text-right min-h-14 cursor-pointer',
                owner >= 0 ? 'bg-slate-50 border-transparent' : 'bg-white border-dashed border-slate-300 hover:border-st-blue')}>
              <span className={cx('w-3 h-3 rounded-full shrink-0', owner >= 0 ? PAIR_COLORS[owner % PAIR_COLORS.length] : 'bg-slate-200')} />
              <Rich text={r} className="flex-1 font-semibold" />
            </button>
          );
        })}
      </div>
      <p className="col-span-2 text-xs text-slate-500">לחצו על פריט מימין ואז על ההתאמה שלו משמאל. כל התאמה מקבלת צבע.</p>
    </div>
  );
}

export function initialResponse(q) {
  if (q.type === 'order') return [...q.items];
  if (q.type === 'match') return q.left.map(() => null);
  return '';
}

export function isAnswered(q, v) {
  if (q.type === 'match') return Array.isArray(v) && v.every((x) => x !== null);
  if (q.type === 'order') return Array.isArray(v);
  return v !== '' && v !== null && v !== undefined && String(v).trim() !== '';
}

export function QuestionInput({ q, value, onChange, disabled, reveal, status, onEnter, correctValue }) {
  switch (q.type) {
    case 'mcq': return <McqInput q={q} value={value} onChange={onChange} disabled={disabled} reveal={reveal} />;
    case 'truefalse': return <TrueFalseInput value={value} onChange={onChange} disabled={disabled} reveal={reveal} />;
    case 'numberline': return <NumberLineInput q={q} value={value} onChange={onChange} disabled={disabled} correctValue={correctValue} status={status} />;
    case 'order': return <OrderInput value={value} onChange={onChange} disabled={disabled} status={status} />;
    case 'match': return <MatchInput q={q} value={value} onChange={onChange} disabled={disabled} status={status} />;
    default: return <MathTextInput key={q.id} value={value} onChange={onChange} disabled={disabled} onEnter={onEnter} unit={q.unit} status={status} />;
  }
}

export const TYPE_LABELS = {
  mcq: 'בחירה מרובה', truefalse: 'נכון / לא נכון', input: 'הקלדת תשובה', numberline: 'ציר המספרים', order: 'סידור', match: 'התאמה',
};

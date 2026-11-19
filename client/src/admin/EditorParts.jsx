// Building blocks for the content editor.
import { useRef, useState } from 'react';
import { ChevronUp, ChevronDown, Trash2, Copy, Plus, ImagePlus, X, Check } from 'lucide-react';
import { api } from '../lib/api.js';
import { Rich } from '../lib/Rich.jsx';
import { Button, Field, IconButton, cx, useUi } from '../ui/ui.jsx';
import { TYPE_LABELS } from '../student/QuestionInputs.jsx';

export const newId = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function move(list, i, d) {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const n = [...list];
  [n[i], n[j]] = [n[j], n[i]];
  return n;
}

/** Textarea / input with live math preview. */
export function RichField({ label, value, onChange, rows = 2, placeholder, hint, single }) {
  const hasMarkup = /\$|\*\*/.test(value || '');
  return (
    <Field label={label} hint={hint}>
      {single ? (
        <input dir="auto" className="field" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <textarea dir="auto" className="field" rows={rows} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
      {hasMarkup && (
        <div className="mt-1.5 px-3 py-2 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-[15px] leading-relaxed">
          <span className="text-[10px] font-black text-slate-400 block">תצוגה מקדימה</span>
          <Rich text={value} />
        </div>
      )}
    </Field>
  );
}

export function StringList({ label, items, onChange, placeholder, addLabel = 'הוספה', numbered, rows = 1 }) {
  return (
    <div>
      {label && <div className="text-[13px] font-bold text-navy-800 mb-1.5">{label}</div>}
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2 items-start">
            {numbered && <span className="w-7 h-10 flex items-center justify-center text-xs font-black text-slate-400 shrink-0">{i + 1}</span>}
            <div className="flex-1">
              {rows > 1 ? <textarea dir="auto" className="field" rows={rows} value={it} placeholder={placeholder} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
                : <input dir="auto" className="field" value={it} placeholder={placeholder} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />}
              {/\$|\*\*/.test(it) && <div className="text-sm px-2 pt-1 text-slate-600"><Rich text={it} /></div>}
            </div>
            <div className="flex">
              <IconButton icon={ChevronUp} label="למעלה" size={16} disabled={i === 0} onClick={() => onChange(move(items, i, -1))} />
              <IconButton icon={ChevronDown} label="למטה" size={16} disabled={i === items.length - 1} onClick={() => onChange(move(items, i, 1))} />
              <IconButton icon={X} label="מחיקה" size={16} className="hover:!text-rose-600" onClick={() => onChange(items.filter((_, j) => j !== i))} />
            </div>
          </div>
        ))}
      </div>
      <Button type="button" size="xs" variant="ghost" icon={Plus} className="mt-1.5" onClick={() => onChange([...items, ''])}>{addLabel}</Button>
    </div>
  );
}

export function ImageField({ value, onChange, label = 'תמונה / שרטוט (לא חובה)' }) {
  const { toast } = useUi();
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { url } = await api.form('/api/admin/uploads', fd);
      onChange(url);
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <Field label={label}>
      <div className="flex gap-2 items-center">
        <input className="field" dir="ltr" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="קישור לתמונה או העלאה" />
        <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files[0]); e.target.value = ''; }} />
        <Button type="button" variant="soft" icon={ImagePlus} loading={busy} onClick={() => ref.current.click()}>העלאה</Button>
      </div>
      {value && <img src={value} alt="" className="mt-2 max-h-32 rounded-xl border border-line" />}
    </Field>
  );
}

/** Collapsible card with reorder / duplicate / delete controls. */
export function ItemCard({ index, total, title, subtitle, badge, open, onToggle, onMove, onDuplicate, onDelete, children, accent = 'border-r-st-blue' }) {
  return (
    <div className={cx('bg-white rounded-2xl border border-line border-r-[5px] shadow-[var(--shadow-card)]', accent)}>
      <div className="flex items-center gap-2 p-3 pr-4">
        <button type="button" onClick={onToggle} className="flex-1 min-w-0 text-right flex items-center gap-3 cursor-pointer">
          <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 text-xs font-black flex items-center justify-center shrink-0">{index + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold truncate"><Rich text={title || 'ללא כותרת'} /></span>
            {subtitle && <span className="block text-xs text-slate-400 truncate">{subtitle}</span>}
          </span>
          {badge}
          <ChevronDown size={18} className={cx('text-slate-400 transition shrink-0', open && 'rotate-180')} />
        </button>
        <div className="flex shrink-0">
          <IconButton icon={ChevronUp} label="הזזה למעלה" size={16} disabled={index === 0} onClick={() => onMove(-1)} />
          <IconButton icon={ChevronDown} label="הזזה למטה" size={16} disabled={index === total - 1} onClick={() => onMove(1)} />
          {onDuplicate && <IconButton icon={Copy} label="שכפול" size={16} onClick={onDuplicate} />}
          <IconButton icon={Trash2} label="מחיקה" size={16} className="hover:!text-rose-600" onClick={onDelete} />
        </div>
      </div>
      {open && <div className="p-4 sm:p-5 pt-1 border-t border-line space-y-4 animate-pop">{children}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ question editor
export function blankQuestion(type = 'mcq', exam = false) {
  const base = { id: newId(exam ? 'eq' : 'q'), type, subtopic: '', prompt: '', hint: '', explanation: '', difficulty: 2, imageUrl: '' };
  if (type === 'mcq') return { ...base, options: ['', '', '', ''], answer: '' };
  if (type === 'truefalse') return { ...base, answer: 'true' };
  if (type === 'input') return { ...base, answer: '', acceptedAnswers: [], unit: '' };
  if (type === 'numberline') return { ...base, min: -10, max: 10, answer: '0' };
  if (type === 'order') return { ...base, items: ['', '', ''] };
  if (type === 'match') return { ...base, pairs: [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }] };
  return base;
}

export function convertType(q, type) {
  const fresh = blankQuestion(type, q.id.startsWith('eq'));
  return { ...fresh, id: q.id, subtopic: q.subtopic, prompt: q.prompt, hint: q.hint, explanation: q.explanation, difficulty: q.difficulty, imageUrl: q.imageUrl };
}

export function questionProblems(q) {
  const p = [];
  if (!q.prompt?.trim()) p.push('חסר ניסוח שאלה');
  if (q.type === 'mcq') {
    const opts = (q.options || []).filter((o) => o.trim());
    if (opts.length < 2) p.push('צריך לפחות 2 אפשרויות');
    if (!q.answer || !opts.includes(q.answer)) p.push('לא סומנה תשובה נכונה');
    if (new Set(opts).size !== opts.length) p.push('יש אפשרויות כפולות');
  }
  if (q.type === 'input' && !String(q.answer || '').trim()) p.push('חסרה תשובה');
  if (q.type === 'order' && (q.items || []).filter((x) => x.trim()).length < 2) p.push('צריך לפחות 2 פריטים');
  if (q.type === 'match' && (q.pairs || []).filter((x) => x.left.trim() && x.right.trim()).length < 2) p.push('צריך לפחות 2 זוגות');
  if (q.type === 'numberline' && (Number(q.answer) < Number(q.min) || Number(q.answer) > Number(q.max))) p.push('התשובה מחוץ לטווח הציר');
  return p;
}

export function QuestionEditor({ q, onChange, exam, subtopics = [] }) {
  const set = (patch) => onChange({ ...q, ...patch });
  const types = exam ? ['mcq', 'truefalse', 'input'] : ['mcq', 'input', 'truefalse', 'numberline', 'order', 'match'];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {types.map((t) => (
          <button key={t} type="button" onClick={() => t !== q.type && onChange(convertType(q, t))}
            className={cx('btn-press h-9 px-3.5 rounded-xl text-sm font-bold border cursor-pointer', q.type === t ? 'bg-navy-900 text-white border-navy-900' : 'bg-white border-line hover:border-slate-300')}>
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-[1fr_160px] gap-3">
        {!exam ? (
          <Field label="תת-נושא">
            <input className="field" list="subtopics-list" value={q.subtopic || ''} onChange={(e) => set({ subtopic: e.target.value })} placeholder="למשל: חיבור וחיסור" />
            <datalist id="subtopics-list">{subtopics.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
        ) : <div />}
        <Field label="רמת קושי">
          <div className="flex gap-1.5">
            {[1, 2, 3].map((d) => (
              <button key={d} type="button" onClick={() => set({ difficulty: d })}
                className={cx('flex-1 h-11 rounded-xl text-sm font-bold border cursor-pointer', q.difficulty === d ? 'bg-st-orange text-white border-st-orange' : 'bg-white border-line')}>
                {['קל', 'בינוני', 'קשה'][d - 1]}
              </button>
            ))}
          </div>
        </Field>
      </div>
      <RichField label="ניסוח השאלה" rows={2} value={q.prompt} onChange={(v) => set({ prompt: v })} placeholder="למשל: מהי התוצאה של $(-8)-(-5)$ ?" hint="ביטויים מתמטיים בתוך $...$ (LaTeX). הדגשה: **טקסט**" />

      {q.type === 'mcq' && (
        <div>
          <div className="text-[13px] font-bold text-navy-800 mb-1.5">אפשרויות – סמני את התשובה הנכונה</div>
          <div className="space-y-2">
            {q.options.map((o, i) => {
              const correct = q.answer === o && o !== '';
              return (
                <div key={i} className="flex items-start gap-2">
                  <button type="button" onClick={() => set({ answer: o })} title="סימון כתשובה נכונה"
                    className={cx('w-10 h-11 rounded-xl border-2 flex items-center justify-center shrink-0 cursor-pointer', correct ? 'bg-st-green border-st-green text-white' : 'border-line text-slate-300 hover:border-st-green')}>
                    <Check size={18} />
                  </button>
                  <div className="flex-1">
                    <input dir="auto" className={cx('field', correct && '!border-st-green')} value={o} placeholder={`אפשרות ${i + 1}`}
                      onChange={(e) => {
                        const v = e.target.value;
                        set({ options: q.options.map((x, j) => (j === i ? v : x)), answer: correct ? v : q.answer });
                      }} />
                    {/\$/.test(o) && <div className="text-sm px-2 pt-1"><Rich text={o} /></div>}
                  </div>
                  <IconButton icon={X} label="מחיקה" size={16} disabled={q.options.length <= 2} onClick={() => set({ options: q.options.filter((_, j) => j !== i), answer: correct ? '' : q.answer })} />
                </div>
              );
            })}
          </div>
          {q.options.length < 6 && <Button type="button" size="xs" variant="ghost" icon={Plus} className="mt-1.5" onClick={() => set({ options: [...q.options, ''] })}>אפשרות</Button>}
        </div>
      )}

      {q.type === 'truefalse' && (
        <Field label="התשובה הנכונה">
          <div className="flex gap-2">
            {[['true', 'נכון'], ['false', 'לא נכון']].map(([v, l]) => (
              <button key={v} type="button" onClick={() => set({ answer: v })} className={cx('h-11 px-6 rounded-xl font-bold border-2 cursor-pointer', q.answer === v ? 'bg-st-green border-st-green text-white' : 'border-line bg-white')}>{l}</button>
            ))}
          </div>
        </Field>
      )}

      {q.type === 'input' && (
        <div className="grid sm:grid-cols-[1fr_1fr_120px] gap-3">
          <Field label="תשובה נכונה" hint="מספר או ביטוי קצר: ‎-5, 3/4, 2x+1"><input className="field" dir="ltr" value={q.answer} onChange={(e) => set({ answer: e.target.value })} /></Field>
          <Field label="תשובות שקולות נוספות" hint="מופרדות בפסיק"><input className="field" dir="ltr" value={(q.acceptedAnswers || []).join(', ')} onChange={(e) => set({ acceptedAnswers: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} placeholder="0.75, 75/100" /></Field>
          <Field label="יחידות"><input dir="auto" className="field" value={q.unit || ''} onChange={(e) => set({ unit: e.target.value })} placeholder='ס"מ' /></Field>
        </div>
      )}

      {q.type === 'numberline' && (
        <div className="grid grid-cols-3 gap-3">
          <Field label="מינימום"><input className="field" type="number" dir="ltr" value={q.min} onChange={(e) => set({ min: Number(e.target.value) })} /></Field>
          <Field label="מקסימום"><input className="field" type="number" dir="ltr" value={q.max} onChange={(e) => set({ max: Number(e.target.value) })} /></Field>
          <Field label="התשובה (מספר שלם)"><input className="field" type="number" dir="ltr" value={q.answer} onChange={(e) => set({ answer: e.target.value })} /></Field>
        </div>
      )}

      {q.type === 'order' && <StringList label="פריטים – בסדר הנכון (התלמיד יראה אותם מעורבבים)" items={q.items} onChange={(items) => set({ items })} numbered addLabel="פריט" />}

      {q.type === 'match' && (
        <div>
          <div className="text-[13px] font-bold text-navy-800 mb-1.5">זוגות להתאמה</div>
          <div className="space-y-2">
            {q.pairs.map((p, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input dir="auto" className="field" value={p.left} placeholder="צד ימין (למשל: $2^3$)" onChange={(e) => set({ pairs: q.pairs.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)) })} />
                <span className="text-slate-400 font-black">↔</span>
                <input dir="auto" className="field" value={p.right} placeholder="ההתאמה (למשל: $8$)" onChange={(e) => set({ pairs: q.pairs.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)) })} />
                <IconButton icon={X} label="מחיקה" size={16} disabled={q.pairs.length <= 2} onClick={() => set({ pairs: q.pairs.filter((_, j) => j !== i) })} />
              </div>
            ))}
          </div>
          {q.pairs.length < 6 && <Button type="button" size="xs" variant="ghost" icon={Plus} className="mt-1.5" onClick={() => set({ pairs: [...q.pairs, { left: '', right: '' }] })}>זוג</Button>}
        </div>
      )}

      {!exam && <RichField label="רמז (מוצג אחרי טעות ראשונה)" value={q.hint} onChange={(v) => set({ hint: v })} placeholder="רמז שמכוון בלי לגלות את התשובה" />}
      <RichField label="הסבר מלא / פתרון" rows={3} value={q.explanation} onChange={(v) => set({ explanation: v })} placeholder="פתרון שלב אחר שלב" />
      <ImageField value={q.imageUrl} onChange={(v) => set({ imageUrl: v })} />
    </div>
  );
}

import { useState } from 'react';
import { ShieldCheck, Crown } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { Button, Field, useUi } from '../ui/ui.jsx';
import { AuthLayout, PasswordInput } from './AuthPage.jsx';
import { burst } from '../lib/fx.js';

export default function SetupPage() {
  const { setUser } = useApp();
  const { toast } = useUi();
  const [f, setF] = useState({ name: 'עדי', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (f.password !== f.confirm) return toast('הסיסמאות אינן תואמות', 'error');
    setLoading(true);
    try {
      const { user } = await api.post('/api/setup', { name: f.name, email: f.email, password: f.password });
      burst();
      toast('המערכת מוכנה! ברוכה הבאה למרכז הניהול 🎉', 'success');
      setUser(user);
    } catch (err) { toast(err.message, 'error'); } finally { setLoading(false); }
  };

  return (
    <AuthLayout side={
      <div className="space-y-4 animate-rise">
        <div className="w-16 h-16 rounded-3xl bg-navy-900 text-gold-400 flex items-center justify-center"><Crown size={32} /></div>
        <h1 className="text-4xl font-black">הגדרה ראשונית</h1>
        <p className="text-lg text-slate-600 leading-relaxed">זו הפעם הראשונה שהמערכת עולה. צרי את חשבון המנהלת שלך – איתו תנהלי תלמידים, תכנים, מבחנים ואת סטודיו ה-AI.</p>
        <p className="text-sm text-slate-500">הנושא "מספרים מכוונים" כבר טעון במערכת ומוכן לשימוש.</p>
      </div>
    }>
      <form onSubmit={submit} className="bg-white rounded-3xl border border-line shadow-[var(--shadow-pop)] p-6 space-y-4 max-w-lg mx-auto w-full animate-pop">
        <div className="flex items-center gap-2 text-navy-900 font-black text-xl"><ShieldCheck className="text-gold-500" /> חשבון מנהלת</div>
        <Field label="שם"><input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
        <Field label="אימייל להתחברות"><input className="field" dir="ltr" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required autoComplete="username" /></Field>
        <Field label="סיסמה" hint="לפחות 8 תווים"><PasswordInput value={f.password} onChange={(v) => setF({ ...f, password: v })} autoComplete="new-password" /></Field>
        <Field label="אימות סיסמה"><PasswordInput value={f.confirm} onChange={(v) => setF({ ...f, confirm: v })} autoComplete="new-password" /></Field>
        <Button type="submit" size="lg" variant="gold" className="w-full" loading={loading} icon={Crown}>יצירת חשבון וכניסה</Button>
      </form>
    </AuthLayout>
  );
}

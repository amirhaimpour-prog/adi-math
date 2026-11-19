import { useEffect, useState } from 'react';
import { Settings, Wand2, Save, KeyRound, ShieldCheck, Download, ExternalLink, CheckCircle2, XCircle, Users, Palette } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { Button, Card, Field, PageLoader, Toggle, useUi } from '../ui/ui.jsx';
import { PasswordInput } from '../pages/AuthPage.jsx';
import { PageHeader } from './AdminApp.jsx';
import { StringList } from './EditorParts.jsx';

export default function SettingsPage() {
  const { reload } = useApp();
  const { toast } = useUi();
  const [s, setS] = useState(null);
  const [models, setModels] = useState(null);
  const [recommended, setRecommended] = useState('');
  const [key, setKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [acct, setAcct] = useState({ name: '', email: '', current: '', next: '' });

  useEffect(() => {
    api.get('/api/admin/settings').then((d) => { setS(d.settings); setAcct({ name: d.admin.name, email: d.admin.email, current: '', next: '' }); }).catch((e) => toast(e.message, 'error'));
  }, [toast]);

  if (!s) return <PageLoader />;
  const set = (patch) => setS({ ...s, ...patch });

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/api/admin/settings', { ...s, geminiApiKey: key });
      setKey('');
      const d = await api.get('/api/admin/settings');
      setS(d.settings);
      await reload();
      toast('ההגדרות נשמרו', 'success');
    } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const list = await api.post('/api/admin/settings/ai-models', { apiKey: key });
      if (!list.ok) { setTestResult({ ok: false, error: list.error }); return; }
      setModels(list.models);
      setRecommended(list.recommended);
      // A saved model that this key can't use falls back to automatic.
      const model = list.models.some((m) => m.id === s.geminiModel) ? s.geminiModel : '';
      if (model !== s.geminiModel) set({ geminiModel: model });
      const r = await api.post('/api/admin/settings/test-ai', { apiKey: key, model });
      setTestResult(r);
    } catch (e) { setTestResult({ ok: false, error: e.message }); } finally { setTesting(false); }
  };

  const saveAccount = async (e) => {
    e.preventDefault();
    try {
      await api.put('/api/admin/account', acct);
      toast('פרטי החשבון עודכנו', 'success');
      setAcct({ ...acct, current: '', next: '' });
      reload();
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div className="animate-rise space-y-5 max-w-4xl">
      <PageHeader title="הגדרות" icon={Settings} color="bg-slate-600"
        actions={<Button icon={Save} loading={saving} onClick={save}>שמירת הגדרות</Button>} />

      <Card className="p-5 sm:p-6 space-y-4">
        <h3 className="font-black text-lg flex items-center gap-2"><Wand2 className="text-st-purple" /> חיבור ה-AI (Gemini)</h3>
        <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 text-sm leading-relaxed">
          <b>איך משיגים מפתח (פעם אחת, בחינם):</b>
          <ol className="list-decimal pr-5 mt-1 space-y-0.5">
            <li>נכנסים ל-<a className="font-bold text-st-purple underline inline-flex items-center gap-0.5" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio <ExternalLink size={12} /></a> עם חשבון Google.</li>
            <li>לוחצים על <b>Create API key</b> ומעתיקים את המפתח.</li>
            <li>מדביקים אותו כאן, לוחצים "בדיקת חיבור" ואז "שמירת הגדרות".</li>
          </ol>
          <p className="text-xs text-slate-500 mt-2">המפתח נשמר בשרת בלבד ולא נחשף לתלמידים.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="מפתח Gemini API" hint={s.geminiKeySet ? `מפתח שמור: ${s.geminiKeyHint} – הזיני חדש רק כדי להחליף` : 'עדיין לא הוגדר מפתח'}>
            <PasswordInput value={key} onChange={setKey} placeholder={s.geminiKeySet ? 'השאירי ריק כדי לא לשנות' : 'הדביקי כאן את המפתח'} autoComplete="off" />
          </Field>
          <Field label="מודל" hint={models ? `${models.length} מודלים זמינים למפתח שלך` : 'לחצי "בדיקת חיבור" כדי לטעון את המודלים הזמינים'}>
            <select className="field" dir="ltr" value={s.geminiModel || ''} onChange={(e) => set({ geminiModel: e.target.value })}>
              <option value="">אוטומטי – המודל הכי טוב שזמין (מומלץ)</option>
              {(models || []).map((m) => <option key={m.id} value={m.id}>{m.name}{m.id === recommended ? ' ⭐' : ''}</option>)}
              {s.geminiModel && !(models || []).some((m) => m.id === s.geminiModel) && <option value={s.geminiModel}>{s.geminiModel}</option>}
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="soft" icon={Wand2} loading={testing} disabled={!key && !s.geminiKeySet} onClick={test}>בדיקת חיבור</Button>
          {testResult && (testResult.ok
            ? (testResult.busy
              ? <span className="text-amber-700 font-bold text-sm flex items-center gap-1"><CheckCircle2 size={17} /> המפתח מחובר ותקין ✓ – השרתים של Google עמוסים רגע, זה זמני.{key ? ' אפשר לשמור.' : ''}</span>
              : <span className="text-emerald-700 font-bold text-sm flex items-center gap-1"><CheckCircle2 size={17} /> החיבור עובד! (מודל: <span dir="ltr">{testResult.model}</span>){key ? ' – עכשיו לחצי "שמירת הגדרות"' : ''}</span>)
            : <span className="text-rose-600 font-bold text-sm flex items-center gap-1"><XCircle size={17} /> {testResult.error}</span>)}
          {s.geminiKeySet && <Button variant="ghost" size="sm" className="!text-rose-600" onClick={async () => { await api.put('/api/admin/settings', { clearGeminiKey: true, geminiApiKey: '' }); set({ geminiKeySet: false, geminiKeyHint: '' }); toast('המפתח נמחק', 'success'); }}>מחיקת המפתח</Button>}
        </div>
      </Card>

      <Card className="p-5 sm:p-6 space-y-4">
        <h3 className="font-black text-lg flex items-center gap-2"><Users className="text-st-green" /> תלמידים והרשמה</h3>
        <Toggle checked={s.registrationOpen} onChange={(v) => set({ registrationOpen: v })} label="ההרשמה פתוחה לתלמידים חדשים" />
        <Toggle checked={s.showLeaderboard} onChange={(v) => set({ showLeaderboard: v })} label="להציג טבלת אלופים שבועית (שמות פרטיים בלבד)" />
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="מספר וואטסאפ של עדי" hint="לכפתור 'עדי, נתקעתי!' ולפניות"><input className="field" dir="ltr" value={s.whatsappPhone} onChange={(e) => set({ whatsappPhone: e.target.value })} /></Field>
          <Field label="יעד XP יומי לתלמיד" hint="כ-6 תשובות נכונות = 60 XP"><input className="field" type="number" min="10" max="500" dir="ltr" value={s.dailyGoalXp} onChange={(e) => set({ dailyGoalXp: e.target.value })} /></Field>
        </div>
      </Card>

      <Card className="p-5 sm:p-6 space-y-4">
        <h3 className="font-black text-lg flex items-center gap-2"><Palette className="text-st-orange" /> מבנה ומיתוג</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="שורת מיקום בתחתית"><input className="field" value={s.brandSubtitle} onChange={(e) => set({ brandSubtitle: e.target.value })} /></Field>
          <Field label="קישור לאתר הבית"><input className="field" dir="ltr" value={s.homeUrl} onChange={(e) => set({ homeUrl: e.target.value })} /></Field>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <StringList label="כיתות / מסגרות" items={s.grades} onChange={(grades) => set({ grades })} addLabel="כיתה" />
          <StringList label="הקבצות / רמות" items={s.levels} onChange={(levels) => set({ levels })} addLabel="הקבצה" />
          <StringList label="מסגרות לימוד" items={s.programs} onChange={(programs) => set({ programs })} addLabel="מסגרת" />
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h3 className="font-black text-lg flex items-center gap-2 mb-4"><ShieldCheck className="text-navy-700" /> החשבון שלי</h3>
        <form onSubmit={saveAccount} className="grid sm:grid-cols-2 gap-3">
          <Field label="שם"><input className="field" value={acct.name} onChange={(e) => setAcct({ ...acct, name: e.target.value })} /></Field>
          <Field label="אימייל להתחברות"><input className="field" dir="ltr" type="email" value={acct.email} onChange={(e) => setAcct({ ...acct, email: e.target.value })} /></Field>
          <Field label="סיסמה חדשה (לא חובה)" hint="לפחות 8 תווים"><PasswordInput value={acct.next} onChange={(v) => setAcct({ ...acct, next: v })} autoComplete="new-password" placeholder="השאירי ריק כדי לא לשנות" /></Field>
          <Field label="סיסמה נוכחית (לאישור)"><PasswordInput value={acct.current} onChange={(v) => setAcct({ ...acct, current: v })} /></Field>
          <div className="sm:col-span-2"><Button type="submit" icon={KeyRound}>עדכון החשבון</Button></div>
        </form>
      </Card>

      <Card className="p-5 sm:p-6 flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-black">גיבוי מלא</h3><p className="text-sm text-slate-500">הורדת כל הנושאים, התלמידים והציונים לקובץ JSON.</p></div>
        <a href="/api/admin/backup" download><Button variant="soft" icon={Download}>הורדת גיבוי</Button></a>
      </Card>
    </div>
  );
}

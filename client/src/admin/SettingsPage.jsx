import { useEffect, useState } from 'react';
import { Settings, Wand2, Save, KeyRound, ShieldCheck, Download, ExternalLink, CheckCircle2, XCircle, Users, Palette } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { Button, Card, Field, PageLoader, Toggle, useUi } from '../ui/ui.jsx';
import { PasswordInput } from '../pages/AuthPage.jsx';
import { PageHeader } from './AdminApp.jsx';
import { StringList } from './EditorParts.jsx';

const ENGINES = {
  openai: {
    title: 'GPT (OpenAI)', keyField: 'openaiApiKey', modelField: 'openaiModel', setFlag: 'openaiKeySet', hintField: 'openaiKeyHint',
    clearFlag: 'clearOpenaiKey', modelsUrl: '/api/admin/settings/openai-models', testUrl: '/api/admin/settings/test-openai',
    howTo: (
      <>
        <li>נכנסים ל-<a className="font-bold text-st-purple underline inline-flex items-center gap-0.5" href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">platform.openai.com/api-keys <ExternalLink size={12} /></a> ומתחברים.</li>
        <li>ב-<b>Billing</b> מוסיפים אמצעי תשלום / קרדיט (יצירת נושא עולה כמה סנטים).</li>
        <li>לוחצים <b>Create new secret key</b>, מעתיקים, מדביקים כאן ולוחצים "בדיקת חיבור".</li>
      </>
    ),
  },
  gemini: {
    title: 'Gemini (Google)', keyField: 'geminiApiKey', modelField: 'geminiModel', setFlag: 'geminiKeySet', hintField: 'geminiKeyHint',
    clearFlag: 'clearGeminiKey', modelsUrl: '/api/admin/settings/ai-models', testUrl: '/api/admin/settings/test-ai',
    howTo: (
      <>
        <li>נכנסים ל-<a className="font-bold text-st-purple underline inline-flex items-center gap-0.5" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio <ExternalLink size={12} /></a> עם חשבון Google.</li>
        <li>לוחצים <b>Create API key</b>, מעתיקים, מדביקים כאן ולוחצים "בדיקת חיבור".</li>
        <li>מפתח חינמי מקבל עדיפות נמוכה ועלול להיתקל ב"עומס" – מומלץ להפעיל Billing.</li>
      </>
    ),
  },
};

function EnginePanel({ engine, s, set, keyValue, setKeyValue, onCleared }) {
  const cfg = ENGINES[engine];
  const { toast } = useUi();
  const [models, setModels] = useState(null);
  const [recommended, setRecommended] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const model = s[cfg.modelField] || '';

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const list = await api.post(cfg.modelsUrl, { apiKey: keyValue });
      if (!list.ok) { setTestResult({ ok: false, error: list.error }); return; }
      setModels(list.models);
      setRecommended(list.recommended);
      const m = list.models.some((x) => x.id === model) ? model : '';
      if (m !== model) set({ [cfg.modelField]: m });
      setTestResult(await api.post(cfg.testUrl, { apiKey: keyValue, model: m }));
    } catch (e) { setTestResult({ ok: false, error: e.message }); } finally { setTesting(false); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 text-sm leading-relaxed">
        <b>איך משיגים מפתח:</b>
        <ol className="list-decimal pr-5 mt-1 space-y-0.5">{cfg.howTo}</ol>
        <p className="text-xs text-slate-500 mt-2">המפתח נשמר בשרת בלבד ולא נחשף לתלמידים.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={`מפתח ${cfg.title}`} hint={s[cfg.setFlag] ? `מפתח שמור: ${s[cfg.hintField]} – הזיני חדש רק כדי להחליף` : 'עדיין לא הוגדר מפתח'}>
          <PasswordInput value={keyValue} onChange={setKeyValue} placeholder={s[cfg.setFlag] ? 'השאירי ריק כדי לא לשנות' : 'הדביקי כאן את המפתח'} autoComplete="off" />
        </Field>
        <Field label="מודל" hint={models ? `${models.length} מודלים זמינים למפתח` : 'לחצי "בדיקת חיבור" כדי לטעון את המודלים'}>
          <select className="field" dir="ltr" value={model} onChange={(e) => set({ [cfg.modelField]: e.target.value })}>
            <option value="">אוטומטי – המודל הכי טוב שזמין (מומלץ)</option>
            {(models || []).map((m) => <option key={m.id} value={m.id}>{m.name}{m.id === recommended ? ' ⭐' : ''}</option>)}
            {model && !(models || []).some((m) => m.id === model) && <option value={model}>{model}</option>}
          </select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="soft" icon={Wand2} loading={testing} disabled={!keyValue && !s[cfg.setFlag]} onClick={test}>בדיקת חיבור</Button>
        {testResult && (testResult.ok
          ? (testResult.busy
            ? <span className="text-amber-700 font-bold text-sm flex items-center gap-1"><XCircle size={17} /> המפתח תקין, אבל אף מודל לא ענה – ראי פירוט למטה.</span>
            : <span className="text-emerald-700 font-bold text-sm flex items-center gap-1"><CheckCircle2 size={17} /> החיבור עובד! (מודל: <span dir="ltr">{testResult.model}</span>){keyValue ? ' – עכשיו לחצי "שמירת הגדרות"' : ''}</span>)
          : <span className="text-rose-600 font-bold text-sm flex items-center gap-1"><XCircle size={17} /> {testResult.error}</span>)}
        {testResult?.results?.length > 0 && (
          <div className="w-full rounded-2xl border border-line bg-slate-50 p-3 text-sm">
            <div className="text-xs font-black text-slate-500 mb-2">פירוט הבדיקה ({testResult.totalModels} מודלים זמינים; נבדקו {testResult.results.length} במקביל)</div>
            <ul className="space-y-1.5">
              {testResult.results.map((r) => (
                <li key={r.model} className="flex items-start gap-2">
                  {r.ok ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" /> : <XCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />}
                  <span className="font-bold shrink-0" dir="ltr">{r.model}</span>
                  <span className="text-slate-500 shrink-0">{(r.ms / 1000).toFixed(1)} שנ׳</span>
                  {!r.ok && <span className="text-rose-700 text-xs break-all" dir="ltr">{r.status ? `[${r.status}] ` : ''}{r.error}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {s[cfg.setFlag] && (
          <Button variant="ghost" size="sm" className="!text-rose-600" onClick={async () => {
            await api.put('/api/admin/settings', { [cfg.clearFlag]: true, [cfg.keyField]: '' });
            onCleared();
            toast('המפתח נמחק', 'success');
          }}>מחיקת המפתח</Button>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { reload } = useApp();
  const { toast } = useUi();
  const [s, setS] = useState(null);
  const [keys, setKeys] = useState({ gemini: '', openai: '' });
  const [tab, setTab] = useState(null);
  const [saving, setSaving] = useState(false);
  const [acct, setAcct] = useState({ name: '', email: '', current: '', next: '' });

  useEffect(() => {
    api.get('/api/admin/settings').then((d) => {
      setS(d.settings);
      setTab(d.settings.aiProvider || 'gemini');
      setAcct({ name: d.admin.name, email: d.admin.email, current: '', next: '' });
    }).catch((e) => toast(e.message, 'error'));
  }, [toast]);

  if (!s) return <PageLoader />;
  const set = (patch) => setS((cur) => ({ ...cur, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/api/admin/settings', { ...s, geminiApiKey: keys.gemini, openaiApiKey: keys.openai });
      setKeys({ gemini: '', openai: '' });
      const d = await api.get('/api/admin/settings');
      setS(d.settings);
      await reload();
      toast('ההגדרות נשמרו', 'success');
    } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
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
        <h3 className="font-black text-lg flex items-center gap-2"><Wand2 className="text-st-purple" /> מנוע ה-AI (לסטודיו AI)</h3>
        <Field label="המנוע הראשי" hint="אם יש מפתח לשני המנועים – כשהראשי לא עונה, המערכת עוברת אוטומטית לשני.">
          <div className="grid grid-cols-2 gap-2 max-w-md">
            {[['openai', 'GPT (OpenAI)'], ['gemini', 'Gemini (Google)']].map(([v, l]) => (
              <button key={v} type="button" onClick={() => { set({ aiProvider: v }); setTab(v); }}
                className={`h-11 rounded-xl font-bold border-2 cursor-pointer ${s.aiProvider === v ? 'bg-st-purple text-white border-st-purple' : 'bg-white border-line'}`}>
                {l}{(v === 'openai' ? s.openaiKeySet : s.geminiKeySet) ? ' ✓' : ''}
              </button>
            ))}
          </div>
        </Field>
        <div className="flex gap-1 border-b border-line">
          {[['openai', 'הגדרות GPT'], ['gemini', 'הגדרות Gemini']].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setTab(v)}
              className={`px-4 h-10 font-bold text-sm cursor-pointer border-b-2 -mb-px ${tab === v ? 'border-st-purple text-navy-900' : 'border-transparent text-slate-500'}`}>{l}</button>
          ))}
        </div>
        <EnginePanel key={tab} engine={tab} s={s} set={set}
          keyValue={keys[tab]} setKeyValue={(v) => setKeys((k) => ({ ...k, [tab]: v }))}
          onCleared={() => set(tab === 'openai' ? { openaiKeySet: false, openaiKeyHint: '' } : { geminiKeySet: false, geminiKeyHint: '' })} />
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

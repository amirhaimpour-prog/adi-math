// OpenAI (GPT) engine for the AI studio — REST, no extra dependencies.
// Models are discovered from the account (GET /v1/models) and the best one is picked
// automatically, so new/retired model names never break the system.
import { getSetting, setSetting } from './db.js';

const OPENAI_BASE = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const modelCache = new Map(); // apiKey -> { at, models }

function fail(message, status, providerMessage) {
  return Object.assign(new Error(message), { status, providerMessage });
}

export async function listOpenAIModels(apiKey) {
  apiKey = apiKey || getSetting('openaiApiKey');
  if (!apiKey) throw fail('לא הוגדר מפתח OpenAI. היכנסי להגדרות והדביקי מפתח.', 400);
  const cached = modelCache.get(apiKey);
  if (cached && Date.now() - cached.at < 30 * 60_000) return cached.models;
  const resp = await fetch(`${OPENAI_BASE}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data?.error?.message || `HTTP ${resp.status}`;
    if (resp.status === 401) throw fail('מפתח ה-OpenAI אינו תקין. בדקי אותו בהגדרות.', 401, msg);
    throw fail(`לא ניתן לקבל את רשימת המודלים מ-OpenAI: ${msg}`, resp.status, msg);
  }
  const models = (data.data || [])
    .map((m) => m.id)
    .filter((id) => /^gpt-/.test(id))
    .filter((id) => !/(audio|realtime|tts|transcribe|search|image|instruct|codex|vision|oss|0301|0314|0613)/i.test(id))
    .map((id) => ({ id, name: id }));
  modelCache.set(apiKey, { at: Date.now(), models });
  return models;
}

export function openaiModelScore(id) {
  const m = id.match(/^gpt-(\d+(?:\.\d+)?)(o)?(?:-(mini|nano|pro|turbo|chat-latest))?(-\d{4}-\d{2}-\d{2}|-preview.*)?$/);
  if (!m) return -1;
  const version = Number(m[1]);
  const variant = m[3] || '';
  if (variant === 'pro') return -1; // very slow & expensive — not for this use
  const tier = { '': 3, 'chat-latest': 2.5, mini: 2, turbo: 1.5, nano: 1 }[variant] ?? 1;
  const snapshot = m[4] ? 0.3 : 0; // prefer the stable alias over dated snapshots / previews
  return version * 10 + tier - snapshot;
}

export function pickBestOpenAIModel(models) {
  const ranked = [...models].sort((a, b) => openaiModelScore(b.id) - openaiModelScore(a.id));
  return ranked.find((m) => openaiModelScore(m.id) >= 0) || ranked[0] || null;
}

async function candidates(apiKey, wanted) {
  const models = await listOpenAIModels(apiKey);
  if (!models.length) throw fail('למפתח הזה אין גישה לאף מודל GPT.', 403);
  const ranked = [...models].sort((a, b) => openaiModelScore(b.id) - openaiModelScore(a.id)).filter((m) => openaiModelScore(m.id) >= 0);
  const preferred = wanted || getSetting('openaiLastGood');
  const first = preferred && models.find((m) => m.id === preferred);
  return (first ? [first, ...ranked.filter((m) => m.id !== first.id)] : ranked).slice(0, 4);
}

/** Converts our neutral "sources" into Chat Completions content parts. */
function sourcesToContent(sources) {
  const parts = [];
  for (const s of sources) {
    if (s.kind === 'text') parts.push({ type: 'text', text: `--- חומר מקור (${s.name || 'טקסט'}) ---\n${s.text.slice(0, 150_000)}` });
    else if (s.kind === 'inline' && s.mimeType.startsWith('image/')) {
      parts.push({ type: 'image_url', image_url: { url: `data:${s.mimeType};base64,${s.data}` } });
    } else if (s.kind === 'inline' && s.mimeType === 'application/pdf') {
      parts.push({ type: 'file', file: { filename: s.name || 'source.pdf', file_data: `data:application/pdf;base64,${s.data}` } });
    } else if (s.kind === 'youtube') {
      throw fail('קישורי YouTube נתמכים רק עם Gemini. העלי במקום זה קובץ או הדביקי טקסט.', 400);
    }
  }
  return parts;
}

async function chatOnce({ apiKey, model, content, json, maxTokens, reasoning, timeoutMs, timeoutMessage }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const body = {
      model,
      messages: [{ role: 'user', content }],
      max_completion_tokens: maxTokens,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
      ...(reasoning ? { reasoning_effort: reasoning } : {}),
    };
    const resp = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = data?.error?.message || `HTTP ${resp.status}`;
      if (resp.status === 401) throw fail('מפתח ה-OpenAI אינו תקין.', 401, msg);
      if (resp.status === 429 && /quota|billing/i.test(msg)) throw fail('אין יתרה בחשבון ה-OpenAI. יש להוסיף אמצעי תשלום/קרדיט ב-platform.openai.com.', 429, msg);
      if (resp.status === 429) throw fail(`חרגת ממגבלת הקצב של OpenAI (מודל "${model}"). נסי שוב בעוד רגע.`, 429, msg);
      if (resp.status === 404) throw fail(`המודל "${model}" אינו זמין למפתח הזה.`, 404, msg);
      throw fail(`שגיאה מ-OpenAI: ${msg}`, resp.status, msg);
    }
    const choice = data.choices?.[0];
    const text = choice?.message?.content || '';
    if (!text) {
      if (choice?.finish_reason === 'length') throw fail('התשובה נקטעה (ארוכה מדי). נסי לבקש פחות שאלות.', 413);
      throw fail(`ה-AI לא החזיר תוכן (${choice?.finish_reason || 'ללא סיבה'}).`, 502);
    }
    return { text, truncated: choice?.finish_reason === 'length' };
  } catch (e) {
    if (e.name === 'AbortError') throw fail(timeoutMessage || 'יצירת התוכן לקחה יותר מדי זמן. נסי שוב או בקשי פחות שאלות.', 504);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** One model, with automatic retries for parameters some models don't accept. */
async function chat(opts) {
  let o = { ...opts };
  for (let i = 0; i < 3; i++) {
    try {
      return await chatOnce(o);
    } catch (e) {
      const pm = e.providerMessage || '';
      if (e.status === 400 && o.reasoning && /reasoning/i.test(pm)) { o = { ...o, reasoning: undefined }; continue; }
      if (e.status === 400 && /max_(completion_)?tokens|maximum.*tokens|too large/i.test(pm) && o.maxTokens > 16000) { o = { ...o, maxTokens: 16000 }; continue; }
      if (e.status === 400 && o.json && /response_format/i.test(pm)) { o = { ...o, json: false }; continue; }
      throw e;
    }
  }
  return chatOnce(o);
}

const RETRYABLE = [403, 404, 429, 500, 502, 503, 504];

/** Generates text/JSON with GPT, falling back across models. Returns { text, model }. */
export async function callOpenAI(promptText, sources = [], { apiKey, model, json = true, maxTokens = 32000, reasoning = 'medium', timeoutMs = 300_000 } = {}) {
  apiKey = apiKey || getSetting('openaiApiKey');
  if (!apiKey) throw fail('לא הוגדר מפתח OpenAI.', 400);
  const content = [{ type: 'text', text: promptText }, ...sourcesToContent(sources)];
  const list = await candidates(apiKey, model || getSetting('openaiModel'));
  let lastErr;
  for (const m of list) {
    try {
      const r = await chat({ apiKey, model: m.id, content, json, maxTokens, reasoning, timeoutMs });
      if (apiKey === getSetting('openaiApiKey')) setSetting('openaiLastGood', m.id);
      return { ...r, model: m.id };
    } catch (e) {
      lastErr = e;
      if (!RETRYABLE.includes(e.status) || /יתרה/.test(e.message)) throw e;
    }
  }
  throw lastErr;
}

/** Parallel quick check of a few models with a per-model report (for the settings screen). */
export async function testOpenAI({ apiKey, model } = {}) {
  apiKey = apiKey || getSetting('openaiApiKey');
  if (!apiKey) throw fail('לא הוגדר מפתח OpenAI.', 400);
  const models = await listOpenAIModels(apiKey);
  const top = (await candidates(apiKey, model)).slice(0, 3);
  const results = await Promise.all(top.map(async (m) => {
    const t0 = Date.now();
    try {
      await chat({
        apiKey, model: m.id, content: [{ type: 'text', text: 'Reply with the single word: OK' }],
        json: false, maxTokens: 2000, reasoning: 'low', timeoutMs: 25_000, timeoutMessage: 'לא הגיב תוך 25 שניות',
      });
      return { model: m.id, ok: true, ms: Date.now() - t0 };
    } catch (e) {
      return { model: m.id, ok: false, ms: Date.now() - t0, status: e.status || 0, error: (e.providerMessage || e.message || '').slice(0, 220) };
    }
  }));
  const working = top.map((p) => results.find((r) => r.model === p.id)).find((r) => r.ok);
  if (working && apiKey === getSetting('openaiApiKey')) setSetting('openaiLastGood', working.model);
  return { reply: working ? 'OK' : '', model: working?.model || '', busy: !working, results, totalModels: models.length };
}

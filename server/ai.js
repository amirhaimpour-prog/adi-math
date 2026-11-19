// AI content studio: turns a PDF / image / Word file / link / free text into a full
// interactive learning unit using the Gemini API. Runs as a background job so the
// admin UI can show progress and the HTTP request never times out.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dns from 'node:dns/promises';
import net from 'node:net';
import mammoth from 'mammoth';
import { db, now, uid, getSetting, saveTopic, getTopic } from './db.js';
import { normalizeTopicContent } from './content.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const MAX_UPLOAD_BYTES = 18 * 1024 * 1024;
const INLINE_MIME = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
]);

// ---------------------------------------------------------------- jobs
function setJob(id, fields) {
  const cur = db.prepare('SELECT * FROM ai_jobs WHERE id = ?').get(id);
  if (!cur) return;
  const next = { ...cur, ...fields, updated_at: now() };
  db.prepare('UPDATE ai_jobs SET status=?, stage=?, error=?, topic_id=?, updated_at=? WHERE id=?')
    .run(next.status, next.stage, next.error, next.topic_id, next.updated_at, id);
}

export function getJob(id) {
  const j = db.prepare('SELECT * FROM ai_jobs WHERE id = ?').get(id);
  if (!j) return null;
  return {
    id: j.id, status: j.status, stage: j.stage, error: j.error, topicId: j.topic_id,
    sourceName: j.source_name, createdAt: j.created_at, updatedAt: j.updated_at,
  };
}

export function listJobs() {
  return db.prepare('SELECT id FROM ai_jobs ORDER BY created_at DESC LIMIT 15').all().map((r) => getJob(r.id));
}

// Jobs interrupted by a restart should not spin forever.
db.prepare("UPDATE ai_jobs SET status='error', error='השרת הופעל מחדש באמצע היצירה. נסי שוב.' WHERE status IN ('queued','running')").run();

// ---------------------------------------------------------------- source extraction
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const l = ip.toLowerCase();
  return l === '::1' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:127.') || l === '::';
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

function youtubeUrl(u) {
  try {
    const url = new URL(u);
    if (/(^|\.)youtube\.com$/.test(url.hostname) || url.hostname === 'youtu.be') return url.toString();
  } catch { /* ignore */ }
  return null;
}

function googleDriveDirect(u) {
  // Turn a Drive "view" link into a direct download link when possible.
  const m = String(u).match(/drive\.google\.com\/file\/d\/([^/]+)/);
  return m ? `https://drive.google.com/uc?export=download&id=${m[1]}` : u;
}

async function fetchUrlSource(rawUrl) {
  let url;
  try { url = new URL(googleDriveDirect(rawUrl.trim())); } catch { throw new Error('הקישור אינו תקין'); }
  if (!/^https?:$/.test(url.protocol)) throw new Error('רק קישורי http/https נתמכים');
  const { address } = await dns.lookup(url.hostname);
  if (isPrivateIp(address)) throw new Error('לא ניתן לייבא מכתובת פנימית');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const resp = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (LearningPlatform importer)' } });
    if (!resp.ok) throw new Error(`לא ניתן לפתוח את הקישור (קוד ${resp.status})`);
    const type = (resp.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length > MAX_UPLOAD_BYTES) throw new Error('הקובץ בקישור גדול מדי (מעל 18MB)');
    if (INLINE_MIME.has(type)) return { kind: 'inline', mimeType: type, data: buf.toString('base64'), name: url.pathname.split('/').pop() || url.hostname };
    if (type.includes('wordprocessingml')) {
      const { value } = await mammoth.extractRawText({ buffer: buf });
      return { kind: 'text', text: value, name: url.hostname };
    }
    const text = type.includes('html') ? htmlToText(buf.toString('utf8')) : buf.toString('utf8');
    if (text.trim().length < 40) throw new Error('לא נמצא תוכן טקסטואלי בקישור. נסי להעלות את הקובץ עצמו.');
    return { kind: 'text', text: text.slice(0, 120_000), name: url.hostname };
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('פתיחת הקישור לקחה יותר מדי זמן');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function fileToSource(file) {
  const name = file.originalname || 'קובץ';
  const ext = path.extname(name).toLowerCase();
  let mime = (file.mimetype || '').toLowerCase();
  if (ext === '.pdf') mime = 'application/pdf';
  if (['.jpg', '.jpeg'].includes(ext)) mime = 'image/jpeg';
  if (ext === '.png') mime = 'image/png';
  if (ext === '.webp') mime = 'image/webp';
  if (INLINE_MIME.has(mime)) return { kind: 'inline', mimeType: mime, data: file.buffer.toString('base64'), name };
  if (ext === '.docx' || mime.includes('wordprocessingml')) {
    const { value } = await mammoth.extractRawText({ buffer: file.buffer });
    if (!value.trim()) throw new Error('לא נמצא טקסט בקובץ ה-Word');
    return { kind: 'text', text: value, name };
  }
  if (ext === '.doc') throw new Error('קובצי ‎.doc ישנים אינם נתמכים. שמרי את הקובץ כ-‎.docx או כ-PDF.');
  if (['.txt', '.md', '.csv', '.tex', '.json'].includes(ext) || mime.startsWith('text/')) {
    return { kind: 'text', text: file.buffer.toString('utf8'), name };
  }
  throw new Error('סוג קובץ לא נתמך. אפשר להעלות PDF, תמונה, Word (docx) או טקסט.');
}

// ---------------------------------------------------------------- prompt
const SCHEMA_EXAMPLE = `{
  "title": "שם הנושא",
  "description": "תיאור קצר ומזמין (1-2 משפטים)",
  "badge": "תגית קצרה, למשל: חומר למבחן",
  "learnSections": [
    {
      "title": "1. כותרת הפרק",
      "summary": "הסבר קצר וברור בגובה העיניים",
      "bullets": ["**מושג:** הסבר עם $x^2$", "..."],
      "workedExample": { "problem": "תרגיל לדוגמה עם $\\\\frac{3}{4}$", "steps": ["שלב 1 ...", "שלב 2 ...", "תשובה סופית: $5$"] },
      "videoUrl": ""
    }
  ],
  "practiceQuestions": [
    { "type": "mcq", "subtopic": "שם תת-נושא", "difficulty": 1, "prompt": "מהי התוצאה של $(-3)\\\\cdot 4$?", "options": ["$-12$", "$12$", "$-7$", "$7$"], "answer": "$-12$", "hint": "רמז מנחה שלא מגלה את התשובה", "explanation": "פתרון מלא שלב אחר שלב" },
    { "type": "input", "subtopic": "...", "difficulty": 2, "prompt": "חשבו: $-9+15-11$", "answer": "-5", "acceptedAnswers": ["-5.0"], "hint": "...", "explanation": "..." },
    { "type": "truefalse", "subtopic": "...", "difficulty": 1, "prompt": "נכון או לא נכון: $(-2)^2=-4$", "answer": "false", "hint": "...", "explanation": "..." },
    { "type": "numberline", "subtopic": "...", "difficulty": 1, "prompt": "סמנו על הציר את $(-6)+4$", "min": -8, "max": 8, "answer": "-2", "hint": "...", "explanation": "..." },
    { "type": "order", "subtopic": "...", "difficulty": 2, "prompt": "סדרו מהקטן לגדול", "items": ["$-7$", "$-2$", "$0$", "$3$"], "hint": "...", "explanation": "..." },
    { "type": "match", "subtopic": "...", "difficulty": 2, "prompt": "התאימו כל תרגיל לתוצאה שלו", "pairs": [{"left": "$2^3$", "right": "$8$"}, {"left": "$3^2$", "right": "$9$"}], "hint": "...", "explanation": "..." }
  ],
  "tips": [ { "title": "כותרת הטיפ", "tag": "מוקש!", "content": "תוכן הטיפ" } ],
  "exams": [
    { "title": "מבחן 1: ...", "levelBadge": "רמה בסיסית • 8 שאלות", "description": "...", "timeLimitMin": 0,
      "questions": [ { "type": "mcq", "prompt": "...", "options": ["...","...","...","..."], "answer": "...", "explanation": "..." } ] }
  ]
}`;

function buildPrompt(opts) {
  const {
    title, grade, level, practiceCount = 24, examCount = 2, examSize = 8, instructions = '', difficulty = 'mixed',
  } = opts;
  return `את/ה מורה מומחה/ית למתמטיקה ומעצב/ת תוכן פדגוגי עבור "עדי - בית למתמטיקה" – מרכז לימוד מתמטיקה לתלמידי חטיבת ביניים ותיכון בישראל.
המשימה: לבנות יחידת לומדה אינטראקטיבית שלמה, בעברית, על בסיס חומר המקור המצורף.

פרטי היעד:
- נושא: ${title || 'זהה בעצמך מתוך חומר המקור'}
- כיתה: ${grade || 'לא צוין'}
- רמה/הקבצה: ${level || 'כל הרמות'}
- רמת קושי מבוקשת: ${difficulty === 'easy' ? 'בסיסית, עם הרבה תרגול מדורג' : difficulty === 'hard' ? 'מאתגרת, ברמת מבחן ומעלה' : 'מדורגת – מקל לקשה'}
${instructions ? `- הנחיות נוספות מעדי: ${instructions}` : ''}

דרישות תוכן:
1. learnSections: 3–6 פרקי הסבר קצרים (micro-learning) בשפה חמה, ברורה ובגובה העיניים, בפנייה בלשון רבים ("פתרו", "שימו לב"). כל פרק: summary, ‏2–5 bullets עם **הדגשות**, ודוגמה פתורה (workedExample) עם 3–5 שלבים.
2. practiceQuestions: בדיוק כ-${practiceCount} שאלות תרגול, מחולקות ל-3–6 תתי-נושאים (subtopic) לפי סדר הלימוד, ומדורגות בקושי (difficulty 1–3).
   - אם בחומר המקור יש תרגילים – חלצו אותם והפכו אותם לשאלות אינטראקטיביות (עם פתרון נכון שחישבתם בעצמכם!), והשלימו שאלות נוספות ברוח החומר.
   - גוון בסוגי השאלות: בערך 45% mcq, ‏30% input, והשאר truefalse / order / match / numberline (numberline רק לתשובה שהיא מספר שלם בין -20 ל-20).
   - mcq: בדיוק 4 אפשרויות; המסיחים חייבים לייצג טעויות נפוצות אמיתיות של תלמידים. answer זהה תו-בתו לאחת האפשרויות.
   - input: answer מספר או ביטוי קצר בלבד (למשל "-5", "3/4", "2x+1"), בלי מילים ובלי סימני $. הוסיפו acceptedAnswers לצורות שקולות.
   - truefalse: answer הוא "true" או "false".
   - order: items מסודרים בסדר הנכון (המערכת תערבב).
   - match: ‏3–5 זוגות.
   - כל שאלה: hint מנחה שלא מסגיר את התשובה, ו-explanation עם פתרון מלא שלב-אחר-שלב.
3. tips: ‏4–6 "הטיפים של עדי" – כללי זהב, מוקשים נפוצים במבחנים ואסטרטגיות בדיקה עצמית.
4. exams: ${examCount} מבחנים מסכמים, כל אחד עם ${examSize} שאלות (mcq / input / truefalse בלבד), מדורגים מבסיסי לסימולציית מבחן מלאה. השאלות במבחנים שונות משאלות התרגול.

כללי כתיבה מתמטית (חשוב מאוד!):
- כל ביטוי מתמטי, מספר בתוך משפט, משתנה או נוסחה – בתוך $...$ בתחביר LaTeX (KaTeX). לדוגמה: $\\\\frac{2}{3}$, $x^2$, $(-4)\\\\cdot(-3)$, $\\\\sqrt{16}$.
- זהו JSON, לכן כל לוכסן הפוך חייב להיות כפול: "\\\\frac", "\\\\cdot", "\\\\sqrt".
- אל תשתמשו ב-$$ (תצוגה מרכזית) בתוך שאלות; רק $ בודד.
- בדקו כל חישוב פעמיים. תשובה שגויה במערכת היא הדבר הגרוע ביותר.

החזירו JSON תקין בלבד (ללא טקסט נוסף, ללא markdown), במבנה הבא בדיוק:
${SCHEMA_EXAMPLE}`;
}

function buildExtendPrompt(topic, { kind, count, instructions }) {
  const existing = (kind === 'exam' ? topic.exams.flatMap((e) => e.questions) : topic.practiceQuestions)
    .slice(0, 60).map((q) => `- ${q.prompt}`).join('\n');
  const learn = topic.learnSections.map((s) => `${s.title}: ${s.summary}`).join('\n');
  const what = kind === 'exam'
    ? `מבחן מסכם חדש אחד עם ${count} שאלות (mcq / input / truefalse בלבד). החזירו {"exams":[{...}]}`
    : `${count} שאלות תרגול חדשות ומגוונות. החזירו {"practiceQuestions":[...]}`;
  return `את/ה מורה מומחה/ית למתמטיקה עבור "עדי - בית למתמטיקה".
נושא: ${topic.title} (${topic.grade} ${topic.level}).
תקציר החומר:
${learn}

שאלות שכבר קיימות (אין לחזור עליהן):
${existing || '(אין)'}

המשימה: צרו ${what}
${instructions ? `הנחיות נוספות: ${instructions}` : ''}
השתמשו באותם כללים ובאותו מבנה כמו בדוגמה. כל ביטוי מתמטי ב-$...$ עם לוכסנים כפולים ב-JSON. בדקו כל חישוב פעמיים.
החזירו JSON תקין בלבד במבנה:
${SCHEMA_EXAMPLE}`;
}

// ---------------------------------------------------------------- Gemini call
function parseJsonLoose(text) {
  let t = String(text || '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try { return JSON.parse(t); } catch { /* try harder */ }
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first >= 0 && last > first) {
    const slice = t.slice(first, last + 1);
    try { return JSON.parse(slice); } catch { /* fallthrough */ }
    // Common model mistake: single backslashes in LaTeX (\frac) inside JSON strings.
    const fixed = slice.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
    try { return JSON.parse(fixed); } catch { /* fallthrough */ }
  }
  throw new Error('תשובת ה-AI לא הייתה JSON תקין. נסי שוב.');
}

/** JSON.parse turns "\frac" into form-feed + "rac", "\t" in "\times" into a TAB, etc. Restore LaTeX. */
export function repairLatexEscapes(value) {
  if (typeof value === 'string') {
    return value
      .replace(/\f/g, '\\f')
      .replace(/\t(?=[a-zA-Z])/g, '\\t')
      .replace(/\x08(?=[a-zA-Z])/g, '\\b')
      .replace(/\r(?=[a-zA-Z])/g, '\\r')
      .replace(/\n(?=eq\b|eq[^a-zA-Z]|abla|otin|ewline)/g, '\\n')
      .replace(/\v/g, '\\v');
  }
  if (Array.isArray(value)) return value.map(repairLatexEscapes);
  if (value && typeof value === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(value)) o[k] = repairLatexEscapes(v);
    return o;
  }
  return value;
}

export async function callGemini(parts, { apiKey, model, maxOutputTokens = 60000, json = true, timeoutMs = 240_000 } = {}) {
  apiKey = apiKey || getSetting('geminiApiKey');
  model = model || getSetting('geminiModel') || 'gemini-2.5-flash';
  if (!apiKey) throw new Error('לא הוגדר מפתח Gemini API. היכנסי להגדרות המערכת והדביקי מפתח.');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens,
          ...(json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = data?.error?.message || `HTTP ${resp.status}`;
      if (resp.status === 400 && /API key/i.test(msg)) throw new Error('מפתח ה-Gemini אינו תקין. בדקי אותו בהגדרות.');
      if (resp.status === 403) throw new Error('למפתח ה-Gemini אין הרשאה למודל הזה. בדקי את המפתח בהגדרות.');
      if (resp.status === 404) throw new Error(`המודל "${model}" לא נמצא. בחרי מודל אחר בהגדרות.`);
      if (resp.status === 429) throw new Error('חרגת ממכסת השימוש של Gemini. נסי שוב בעוד כמה דקות.');
      throw new Error(`שגיאה משירות ה-AI: ${msg}`);
    }
    const cand = data?.candidates?.[0];
    const text = (cand?.content?.parts || []).map((p) => p.text || '').join('');
    if (!text) {
      const reason = cand?.finishReason || data?.promptFeedback?.blockReason || 'ללא תוכן';
      throw new Error(`ה-AI לא החזיר תוכן (${reason}). נסי קובץ אחר או הוסיפי טקסט.`);
    }
    if (cand?.finishReason === 'MAX_TOKENS' && json) {
      // Try to salvage, otherwise ask for fewer questions.
      try { return repairLatexEscapes(parseJsonLoose(text)); } catch {
        throw new Error('התוכן שנוצר ארוך מדי. נסי לבקש פחות שאלות.');
      }
    }
    return json ? repairLatexEscapes(parseJsonLoose(text)) : text;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('יצירת התוכן לקחה יותר מדי זמן. נסי שוב או בקשי פחות שאלות.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function testGemini({ apiKey, model }) {
  const text = await callGemini([{ text: 'Reply with the single word: OK' }], { apiKey, model, json: false, maxOutputTokens: 200, timeoutMs: 30_000 });
  return String(text).trim().slice(0, 40);
}

function sourceToParts(sources) {
  const parts = [];
  for (const s of sources) {
    if (s.kind === 'inline') parts.push({ inline_data: { mime_type: s.mimeType, data: s.data } });
    else if (s.kind === 'youtube') parts.push({ file_data: { file_uri: s.url } });
    else if (s.kind === 'text') parts.push({ text: `--- חומר מקור (${s.name || 'טקסט'}) ---\n${s.text.slice(0, 150_000)}` });
  }
  return parts;
}

// ---------------------------------------------------------------- mock (for tests / demo without a key)
function mockGenerated(title) {
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed', 'directed-numbers.json'), 'utf8'));
  return {
    title: title || 'נושא לדוגמה (מצב הדגמה)',
    description: 'יחידה שנוצרה במצב הדגמה ללא מפתח AI.',
    badge: 'נוצר ב-AI ✨',
    learnSections: seed.learnSections.slice(0, 2),
    practiceQuestions: [
      ...seed.practiceQuestions.slice(0, 6),
      { type: 'truefalse', subtopic: 'בדיקה', prompt: 'נכון או לא נכון: $(-2)^2=-4$', answer: 'false', hint: 'מה קורה כשכופלים שני שליליים?', explanation: '$(-2)\\cdot(-2)=4$' },
      { type: 'order', subtopic: 'בדיקה', prompt: 'סדרו מהקטן לגדול', items: ['$-7$', '$-2$', '$0$', '$3$'], hint: 'ככל שמאלה – קטן יותר', explanation: '$-7<-2<0<3$' },
      { type: 'match', subtopic: 'בדיקה', prompt: 'התאימו', pairs: [{ left: '$2^3$', right: '$8$' }, { left: '$3^2$', right: '$9$' }, { left: '$(-1)^5$', right: '$-1$' }], hint: 'חשבו כל חזקה', explanation: '...' },
    ],
    tips: seed.tips.slice(0, 2),
    exams: [seed.exams[0]],
  };
}

// ---------------------------------------------------------------- public API
export function startGenerateJob({ sources, opts }) {
  const id = uid('job-');
  const t = now();
  const name = sources.map((s) => s.name).filter(Boolean).join(', ').slice(0, 200) || 'טקסט חופשי';
  db.prepare('INSERT INTO ai_jobs(id, status, stage, error, topic_id, source_name, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(id, 'running', 'reading', '', '', name, t, t);

  (async () => {
    try {
      let generated;
      if (process.env.AI_MOCK === '1') {
        setJob(id, { stage: 'thinking' });
        await new Promise((r) => setTimeout(r, 400));
        generated = mockGenerated(opts.title);
      } else {
        setJob(id, { stage: 'thinking' });
        const parts = [{ text: buildPrompt(opts) }, ...sourceToParts(sources)];
        generated = await callGemini(parts);
      }
      setJob(id, { stage: 'building' });
      const content = normalizeTopicContent(generated);
      if (!content.practiceQuestions.length && !content.learnSections.length) {
        throw new Error('ה-AI לא הצליח לבנות תוכן מהחומר. נסי קובץ ברור יותר או הוסיפי הסבר בטקסט.');
      }
      const topicId = uid('topic-');
      saveTopic({
        id: topicId,
        title: (opts.title || generated.title || 'נושא חדש').slice(0, 200),
        grade: opts.grade || '',
        level: opts.level || '',
        description: String(generated.description || '').slice(0, 600),
        badge: String(generated.badge || 'חדש ✨').slice(0, 60),
        color: opts.color || '',
        status: 'draft',
        ...content,
      }, { aiGenerated: true });
      setJob(id, { status: 'done', stage: 'done', topic_id: topicId });
    } catch (e) {
      console.error('[ai] generate failed:', e.message);
      setJob(id, { status: 'error', stage: 'error', error: e.message || 'שגיאה לא צפויה' });
    }
  })();
  return getJob(id);
}

export function startExtendJob({ topicId, kind, count, instructions }) {
  const topic = getTopic(topicId);
  if (!topic) throw new Error('הנושא לא נמצא');
  const id = uid('job-');
  const t = now();
  db.prepare('INSERT INTO ai_jobs(id, status, stage, error, topic_id, source_name, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(id, 'running', 'thinking', '', topicId, `הרחבה: ${topic.title}`, t, t);

  (async () => {
    try {
      let generated;
      if (process.env.AI_MOCK === '1') {
        await new Promise((r) => setTimeout(r, 300));
        const m = mockGenerated();
        generated = kind === 'exam' ? { exams: m.exams } : { practiceQuestions: m.practiceQuestions.slice(0, count) };
      } else {
        generated = await callGemini([{ text: buildExtendPrompt(topic, { kind, count, instructions }) }]);
      }
      setJob(id, { stage: 'building' });
      const fresh = getTopic(topicId); // re-read in case it was edited meanwhile
      if (!fresh) throw new Error('הנושא נמחק בזמן היצירה');
      const stamp = Date.now().toString(36);
      if (kind === 'exam') {
        const exams = (Array.isArray(generated.exams) ? generated.exams : []).map((e, i) => ({ ...e, id: `exam-${stamp}-${i}` }));
        if (!exams.length) throw new Error('לא נוצר מבחן. נסי שוב.');
        fresh.exams = [...fresh.exams, ...exams];
      } else {
        const qs = (Array.isArray(generated.practiceQuestions) ? generated.practiceQuestions : []).map((q, i) => ({ ...q, id: `q-${stamp}-${i}` }));
        if (!qs.length) throw new Error('לא נוצרו שאלות. נסי שוב.');
        fresh.practiceQuestions = [...fresh.practiceQuestions, ...qs];
      }
      saveTopic(fresh);
      setJob(id, { status: 'done', stage: 'done' });
    } catch (e) {
      console.error('[ai] extend failed:', e.message);
      setJob(id, { status: 'error', stage: 'error', error: e.message || 'שגיאה לא צפויה' });
    }
  })();
  return getJob(id);
}

export async function collectSources({ files = [], url = '', text = '' }) {
  const sources = [];
  for (const f of files) sources.push(await fileToSource(f));
  if (url && url.trim()) {
    const yt = youtubeUrl(url.trim());
    sources.push(yt ? { kind: 'youtube', url: yt, name: 'YouTube' } : await fetchUrlSource(url));
  }
  if (text && text.trim()) sources.push({ kind: 'text', text: text.trim(), name: 'טקסט' });
  return sources;
}

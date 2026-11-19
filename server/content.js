// Topic content schema: normalization, sanitization, student-safe views and answer checking.
// Everything that comes from the editor or from the AI goes through normalizeTopicContent,
// so the student UI can rely on a consistent shape.

export const QUESTION_TYPES = ['mcq', 'truefalse', 'input', 'numberline', 'order', 'match'];
export const EXAM_QUESTION_TYPES = ['mcq', 'truefalse', 'input'];

const str = (v, max = 4000) => (v === null || v === undefined ? '' : String(v)).slice(0, max);
const arr = (v) => (Array.isArray(v) ? v : []);
const num = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

function makeIdFactory(prefix) {
  const used = new Set();
  let i = 0;
  return (candidate) => {
    let id = str(candidate, 80).trim().replace(/[^\w\-א-ת]/g, '-');
    if (!id || used.has(id)) {
      do { i += 1; id = `${prefix}-${i}`; } while (used.has(id));
    }
    used.add(id);
    return id;
  };
}

export function normalizeTrueFalse(v) {
  const s = str(v).trim().toLowerCase();
  if (['true', 'נכון', 'כן', 'אמת', 'yes', '1'].includes(s)) return 'true';
  if (['false', 'לא נכון', 'לא', 'שקר', 'no', '0', 'לא-נכון'].includes(s)) return 'false';
  return '';
}

export function normalizeQuestion(q, nextId, { exam = false } = {}) {
  q = q && typeof q === 'object' ? q : {};
  let type = QUESTION_TYPES.includes(q.type) ? q.type : (arr(q.options).length ? 'mcq' : 'input');
  if (exam && !EXAM_QUESTION_TYPES.includes(type)) type = arr(q.options).length ? 'mcq' : 'input';

  const out = {
    id: nextId(q.id),
    type,
    subtopic: str(q.subtopic, 120).trim(),
    prompt: str(q.prompt).trim() || 'שאלה ללא ניסוח',
    hint: str(q.hint).trim(),
    explanation: str(q.explanation).trim(),
    imageUrl: str(q.imageUrl, 1000).trim(),
    difficulty: Math.min(3, Math.max(1, Math.round(num(q.difficulty, 2)))),
  };

  if (type === 'mcq') {
    const options = [...new Set(arr(q.options).map((o) => str(o, 600).trim()).filter(Boolean))].slice(0, 6);
    let answer = str(q.answer, 600).trim();
    // Accept answer given as index ("0"/"א") or letter.
    if (!options.includes(answer)) {
      const letters = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
      const li = letters.indexOf(answer.replace(/['׳]/g, ''));
      const ni = /^\d+$/.test(answer) ? Number(answer) : -1;
      const latin = /^[a-f]$/i.test(answer) ? answer.toLowerCase().charCodeAt(0) - 97 : -1;
      const idx = li >= 0 ? li : latin >= 0 ? latin : ni;
      if (idx >= 0 && idx < options.length) answer = options[idx];
    }
    if (!options.includes(answer) && answer) options.push(answer);
    if (!answer && options.length) answer = options[0];
    while (options.length < 2) options.push(`אפשרות ${options.length + 1}`);
    out.options = options;
    out.answer = answer;
  } else if (type === 'truefalse') {
    out.answer = normalizeTrueFalse(q.answer) || 'true';
  } else if (type === 'input') {
    out.answer = str(q.answer, 200).trim().replace(/^\$+|\$+$/g, '') || '0';
    out.acceptedAnswers = arr(q.acceptedAnswers).map((a) => str(a, 200).trim()).filter(Boolean).slice(0, 10);
    out.unit = str(q.unit, 40).trim();
  } else if (type === 'numberline') {
    out.min = Math.round(num(q.min, -10));
    out.max = Math.round(num(q.max, 10));
    if (out.max <= out.min) out.max = out.min + 10;
    if (out.max - out.min > 40) out.max = out.min + 40;
    let a = num(str(q.answer).replace(/[$\s]/g, '').replace(/[−–]/g, '-'), 0);
    a = Math.round(a);
    if (a < out.min) out.min = a - 2;
    if (a > out.max) out.max = a + 2;
    out.answer = String(a);
  } else if (type === 'order') {
    const items = arr(q.items).map((i) => str(i, 300).trim()).filter(Boolean).slice(0, 8);
    while (items.length < 2) items.push(`פריט ${items.length + 1}`);
    out.items = items; // stored in the CORRECT order
  } else if (type === 'match') {
    const pairs = arr(q.pairs)
      .map((p) => ({ left: str(p?.left, 300).trim(), right: str(p?.right, 300).trim() }))
      .filter((p) => p.left && p.right)
      .slice(0, 6);
    while (pairs.length < 2) pairs.push({ left: `פריט ${pairs.length + 1}`, right: `התאמה ${pairs.length + 1}` });
    out.pairs = pairs;
  }
  return out;
}

export function normalizeTopicContent(raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const secId = makeIdFactory('sec');
  const qId = makeIdFactory('q');
  const tipId = makeIdFactory('tip');
  const examId = makeIdFactory('exam');

  const learnSections = arr(raw.learnSections).map((s) => {
    s = s && typeof s === 'object' ? s : {};
    const we = s.workedExample && typeof s.workedExample === 'object' ? s.workedExample : null;
    return {
      id: secId(s.id),
      title: str(s.title, 300).trim() || 'פרק',
      summary: str(s.summary).trim(),
      bullets: arr(s.bullets).map((b) => str(b, 1500).trim()).filter(Boolean).slice(0, 12),
      workedExample: we && (we.problem || arr(we.steps).length)
        ? { problem: str(we.problem, 1500).trim(), steps: arr(we.steps).map((x) => str(x, 1500).trim()).filter(Boolean).slice(0, 12) }
        : null,
      videoUrl: str(s.videoUrl, 1000).trim(),
      imageUrl: str(s.imageUrl, 1000).trim(),
      hasNumberLineExplorer: !!s.hasNumberLineExplorer,
    };
  });

  const practiceQuestions = arr(raw.practiceQuestions).map((q) => normalizeQuestion(q, qId)).slice(0, 200);

  const tips = arr(raw.tips).map((t) => ({
    id: tipId(t?.id),
    title: str(t?.title, 300).trim() || 'טיפ',
    tag: str(t?.tag, 60).trim(),
    content: str(t?.content).trim(),
  }));

  let examsRaw = arr(raw.exams);
  if (!examsRaw.length && arr(raw.examQuestions).length) {
    examsRaw = [{ title: 'מבחן מסכם', questions: raw.examQuestions }];
  }
  const exams = examsRaw.map((e) => {
    const eqId = makeIdFactory('eq');
    return {
      id: examId(e?.id),
      title: str(e?.title, 300).trim() || 'מבחן',
      levelBadge: str(e?.levelBadge, 80).trim(),
      description: str(e?.description, 1000).trim(),
      timeLimitMin: Math.max(0, Math.min(240, Math.round(num(e?.timeLimitMin, 0)))),
      questions: arr(e?.questions).map((q) => normalizeQuestion(q, eqId, { exam: true })).slice(0, 60),
    };
  });

  return { learnSections, practiceQuestions, tips, exams };
}

// ---------- student-safe views ----------
function seededShuffle(list, seedStr) {
  const a = [...list];
  let h = 2166136261;
  for (const ch of String(seedStr)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rnd = () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // Make sure an "order" puzzle is never shown already solved.
  if (a.length > 1 && a.every((x, i) => x === list[i])) a.push(a.shift());
  return a;
}

export function publicQuestion(q, seed = '') {
  const base = {
    id: q.id, type: q.type, subtopic: q.subtopic, prompt: q.prompt, hint: q.hint,
    imageUrl: q.imageUrl, difficulty: q.difficulty,
  };
  if (q.type === 'mcq') base.options = seed ? seededShuffle(q.options, q.id + seed) : q.options;
  if (q.type === 'input') base.unit = q.unit;
  if (q.type === 'numberline') { base.min = q.min; base.max = q.max; }
  if (q.type === 'order') base.items = seededShuffle(q.items, q.id + 'o' + seed);
  if (q.type === 'match') {
    base.left = q.pairs.map((p) => p.left);
    base.right = seededShuffle(q.pairs.map((p) => p.right), q.id + 'm' + seed);
  }
  return base;
}

export function publicTopic(topic) {
  return {
    id: topic.id, title: topic.title, grade: topic.grade, level: topic.level,
    description: topic.description, badge: topic.badge, color: topic.color,
    learnSections: topic.learnSections,
    tips: topic.tips,
    practiceQuestions: topic.practiceQuestions.map((q) => publicQuestion(q)),
    exams: topic.exams.map((e) => ({
      id: e.id, title: e.title, levelBadge: e.levelBadge, description: e.description,
      timeLimitMin: e.timeLimitMin, questionCount: e.questions.length,
    })),
  };
}

// ---------- answer checking ----------
function normalizeMath(v) {
  return str(v, 300)
    .replace(/\$/g, '')
    .replace(/\\left|\\right/g, '')
    .replace(/\\cdot|\\times|×|·/g, '*')
    .replace(/\\div|÷|:/g, '/')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    .replace(/[−–—]/g, '-')
    .replace(/\s+/g, '')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/^\+/, '')
    .replace(/^x=|^=/i, '')
    .toLowerCase();
}

function numericValue(s) {
  const t = normalizeMath(s).replace(/^\((.*)\)$/, '$1');
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  let m = t.match(/^\(?(-?\d+(?:\.\d+)?)\)?\/\(?(-?\d+(?:\.\d+)?)\)?$/);
  if (m && Number(m[2]) !== 0) return Number(m[1]) / Number(m[2]);
  m = t.match(/^-?\(?(-?\d+(?:\.\d+)?)\)?\/\(?(-?\d+(?:\.\d+)?)\)?$/);
  if (m && t.startsWith('-') && Number(m[2]) !== 0) return -Number(m[1]) / Number(m[2]);
  // mixed number "2 1/2" was collapsed to "21/2" — not supported intentionally.
  return null;
}

export function answersEqual(given, expected) {
  const a = normalizeMath(given);
  const b = normalizeMath(expected);
  if (!a) return false;
  if (a === b) return true;
  const na = numericValue(a);
  const nb = numericValue(b);
  if (na !== null && nb !== null) return Math.abs(na - nb) < 1e-6 * Math.max(1, Math.abs(nb));
  return false;
}

export function checkAnswer(q, response) {
  switch (q.type) {
    case 'mcq':
      return str(response, 600).trim() === q.answer;
    case 'truefalse':
      return normalizeTrueFalse(response) === q.answer;
    case 'input':
      return [q.answer, ...(q.acceptedAnswers || [])].some((exp) => answersEqual(response, exp));
    case 'numberline':
      return Number(response) === Number(q.answer);
    case 'order':
      return Array.isArray(response) && response.length === q.items.length && response.every((x, i) => x === q.items[i]);
    case 'match':
      return Array.isArray(response) && response.length === q.pairs.length && response.every((x, i) => x === q.pairs[i].right);
    default:
      return false;
  }
}

export function displayAnswer(q) {
  switch (q.type) {
    case 'truefalse': return q.answer === 'true' ? 'נכון' : 'לא נכון';
    case 'input': return q.answer.includes('$') ? q.answer : `$${q.answer}$`;
    case 'numberline': return `$${q.answer}$`;
    case 'order': return q.items.join('  ←  ');
    case 'match': return q.pairs.map((p) => `${p.left} ↔ ${p.right}`).join(' | ');
    default: return q.answer;
  }
}

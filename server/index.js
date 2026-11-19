// עדי - בית למתמטיקה — API server + static client.
import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  db, now, uid, tx, israelDay, DATA_DIR, getSetting, setSetting, getAllSettings, getJsonSetting,
  getTopic, listTopics, saveTopic, seedIfEmpty,
} from './db.js';
import {
  hashPassword, verifyPassword, createSession, destroySession, cookieOptions, loadUser,
  requireUser, requireApprovedStudent, requireAdmin, rateLimit, publicUser, SESSION_COOKIE,
} from './auth.js';
import { publicTopic, publicQuestion, checkAnswer, displayAnswer, normalizeTopicContent } from './content.js';
import {
  addXp, levelInfo, BADGES, getUserBadges, checkPracticeBadges, checkExamBadges, todayXp, dailyGoal, liveStreak,
} from './game.js';
import {
  startGenerateJob, startExtendJob, getJob, listJobs, collectSources, testGemini, listGeminiModels, pickBestModel, MAX_UPLOAD_BYTES,
} from './ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, '..', 'dist');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

seedIfEmpty();

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});
app.use(express.json({ limit: '6mb' }));
app.use(cookieParser());
app.use(loadUser);

// CSRF guard: state-changing API calls must come from our own JS (custom header can't be sent cross-site without CORS).
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.get('X-Requested-With') !== 'adi-math') {
    return res.status(403).json({ error: 'בקשה לא מורשית' });
  }
  next();
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 5 } });
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const digits = (p) => String(p || '').replace(/\D/g, '');

// ================================================================ access helpers
function hasAdmin() {
  return !!db.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get();
}

function accessibleTopicIds(user) {
  if (user.role === 'admin') return new Set(listTopics().map((t) => t.id));
  const rows = db.prepare(`
    SELECT t.id FROM topics t WHERE t.status = 'published' AND (
      EXISTS (SELECT 1 FROM topic_access a WHERE a.user_id = ? AND a.topic_id = t.id)
      OR EXISTS (SELECT 1 FROM grade_access g WHERE g.user_id = ? AND g.grade = t.grade AND t.grade != '')
    )`).all(user.id, user.id);
  return new Set(rows.map((r) => r.id));
}

function topicForUser(req, res) {
  const topic = getTopic(req.params.topicId);
  if (!topic) { bad(res, 'הנושא לא נמצא', 404); return null; }
  if (!accessibleTopicIds(req.user).has(topic.id)) { bad(res, 'אין לך גישה לנושא הזה. פנו לעדי.', 403); return null; }
  return topic;
}

function userAccess(userId) {
  return {
    grades: db.prepare('SELECT grade FROM grade_access WHERE user_id = ?').all(userId).map((r) => r.grade),
    topicIds: db.prepare('SELECT topic_id FROM topic_access WHERE user_id = ?').all(userId).map((r) => r.topic_id),
  };
}

function publicSettings() {
  return {
    whatsappPhone: getSetting('whatsappPhone'),
    brandSubtitle: getSetting('brandSubtitle'),
    homeUrl: getSetting('homeUrl'),
    registrationOpen: getSetting('registrationOpen') === 'true',
    showLeaderboard: getSetting('showLeaderboard') === 'true',
    grades: getJsonSetting('grades'),
    levels: getJsonSetting('levels'),
    programs: getJsonSetting('programs'),
  };
}

function meExtras(u) {
  if (!u) return null;
  return {
    ...publicUser(u),
    streak: liveStreak(u),
    levelInfo: levelInfo(u.xp),
    todayXp: todayXp(u.id),
    dailyGoal: dailyGoal(),
  };
}

// ================================================================ public / auth
app.get('/api/bootstrap', (req, res) => {
  let invite = null;
  const inviteId = clean(req.query.topic, 100);
  if (inviteId) {
    const t = db.prepare("SELECT id, title, grade FROM topics WHERE id = ? AND status = 'published'").get(inviteId);
    if (t) invite = t;
  }
  res.json({ needsSetup: !hasAdmin(), settings: publicSettings(), user: meExtras(req.user), invite });
});

app.post('/api/setup', rateLimit({ windowMs: 15 * 60_000, max: 10, key: 'setup' }), (req, res) => {
  if (hasAdmin()) return bad(res, 'המערכת כבר הוגדרה', 409);
  const name = clean(req.body.name, 80) || 'עדי';
  const email = clean(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || '');
  if (!emailOk(email)) return bad(res, 'כתובת אימייל לא תקינה');
  if (password.length < 8) return bad(res, 'הסיסמה צריכה להכיל לפחות 8 תווים');
  const id = uid('adm-');
  db.prepare(`INSERT INTO users(id, role, name, email, phone, password_hash, status, created_at)
    VALUES(?, 'admin', ?, ?, '', ?, 'approved', ?)`).run(id, name, email, hashPassword(password), now());
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.cookie(SESSION_COOKIE, createSession(user, req.get('user-agent')), cookieOptions(req));
  res.json({ user: meExtras(user) });
});

// Limits are generous on purpose: a whole class may share one school IP.
app.post('/api/auth/register', rateLimit({ windowMs: 60 * 60_000, max: 120, key: 'register' }), (req, res) => {
  if (getSetting('registrationOpen') !== 'true') return bad(res, 'ההרשמה סגורה כרגע. פנו לעדי בוואטסאפ.', 403);
  const name = clean(req.body.name, 80);
  const phone = clean(req.body.phone, 30);
  const email = clean(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || '');
  if (name.length < 2) return bad(res, 'נא למלא שם מלא');
  if (digits(phone).length < 9) return bad(res, 'נא למלא מספר טלפון תקין');
  if (!emailOk(email)) return bad(res, 'כתובת אימייל לא תקינה');
  if (password.length < 6) return bad(res, 'הסיסמה צריכה להכיל לפחות 6 תווים');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return bad(res, 'האימייל כבר רשום במערכת. עברו להתחברות.', 409);
  }
  const requested = clean(req.body.requestedTopic, 100);
  const id = uid('stu-');
  db.prepare(`INSERT INTO users(id, role, name, email, phone, password_hash, grade, level, program, status, requested_topic, created_at)
    VALUES(?, 'student', ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`)
    .run(id, name, email, phone, hashPassword(password), clean(req.body.grade, 40), clean(req.body.level, 40),
      clean(req.body.program, 60), requested, now());
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.cookie(SESSION_COOKIE, createSession(user, req.get('user-agent')), cookieOptions(req));
  res.json({ user: meExtras(user) });
});

app.post('/api/auth/login', rateLimit({ windowMs: 15 * 60_000, max: 150, key: 'login' }), (req, res) => {
  const identifier = clean(req.body.identifier, 160).toLowerCase();
  const password = String(req.body.password || '');
  if (!identifier || !password) return bad(res, 'נא למלא פרטי התחברות');
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(identifier);
  if (!user && digits(identifier).length >= 9) {
    const d = digits(identifier).replace(/^972/, '0');
    user = db.prepare('SELECT * FROM users').all().find((u) => digits(u.phone).replace(/^972/, '0') === d && u.role === 'student');
  }
  if (!user || !verifyPassword(password, user.password_hash)) return bad(res, 'פרטי ההתחברות שגויים. נסו שוב.', 401);
  if (user.status === 'blocked') return bad(res, 'הגישה לחשבון זה הוקפאה. פנו לעדי בוואטסאפ.', 403);
  res.cookie(SESSION_COOKIE, createSession(user, req.get('user-agent')), cookieOptions(req));
  res.json({ user: meExtras(user) });
});

app.post('/api/auth/logout', (req, res) => {
  destroySession(req.sessionToken);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

app.put('/api/me/password', requireUser, (req, res) => {
  const { current, next } = req.body || {};
  if (!verifyPassword(current, req.user.password_hash)) return bad(res, 'הסיסמה הנוכחית שגויה');
  if (String(next || '').length < 6) return bad(res, 'הסיסמה החדשה קצרה מדי');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), req.user.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(req.user.id, req.sessionToken);
  res.json({ ok: true });
});

app.patch('/api/me', requireUser, (req, res) => {
  const avatar = clean(req.body.avatar, 16);
  if (avatar) db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, req.user.id);
  res.json({ user: meExtras(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

// ================================================================ student
function topicProgress(userId, topic) {
  const solvedIds = db.prepare('SELECT question_id FROM solved WHERE user_id = ? AND topic_id = ?').all(userId, topic.id).map((r) => r.question_id);
  const valid = new Set(topic.practiceQuestions.map((q) => q.id));
  const solved = solvedIds.filter((id) => valid.has(id));
  const best = db.prepare('SELECT MAX(score) AS s, COUNT(*) AS c FROM exam_results WHERE user_id = ? AND topic_id = ?').get(userId, topic.id);
  const total = topic.practiceQuestions.length;
  const pct = total ? solved.length / total : 0;
  let status = 'new';
  if (solved.length > 0 || best.c > 0) status = 'progress';
  if ((total && pct >= 0.8 && best.s >= 70) || (!total && best.s >= 70)) status = 'done';
  return { solvedIds: solved, solved: solved.length, total, bestExam: best.s ?? null, examsTaken: best.c, status };
}

app.get('/api/me/dashboard', requireApprovedStudent, (req, res) => {
  const u = req.user;
  const ids = accessibleTopicIds(u);
  const topics = listTopics().filter((t) => ids.has(t.id) && t.status === 'published').map((t) => ({
    id: t.id, title: t.title, grade: t.grade, level: t.level, description: t.description, badge: t.badge, color: t.color,
    sections: t.learnSections.length, exams: t.exams.length, ...topicProgress(u.id, t), solvedIds: undefined,
  }));

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = israelDay(Date.now() - i * 86400000);
    const r = db.prepare('SELECT xp, answers FROM activity WHERE user_id = ? AND day = ?').get(u.id, d);
    days.push({ day: d, xp: r?.xp || 0, answers: r?.answers || 0 });
  }

  let leaderboard = null;
  if (getSetting('showLeaderboard') === 'true') {
    const since = israelDay(Date.now() - 6 * 86400000);
    const rows = db.prepare(`SELECT u.id, u.name, u.avatar, COALESCE(SUM(a.xp),0) AS wxp
      FROM users u LEFT JOIN activity a ON a.user_id = u.id AND a.day >= ?
      WHERE u.role = 'student' AND u.status = 'approved'
      GROUP BY u.id HAVING wxp > 0 ORDER BY wxp DESC LIMIT 50`).all(since);
    const idx = rows.findIndex((r) => r.id === u.id);
    leaderboard = {
      top: rows.slice(0, 10).map((r, i) => ({ rank: i + 1, name: r.name.split(' ')[0], avatar: r.avatar, xp: r.wxp, me: r.id === u.id })),
      myRank: idx >= 0 ? idx + 1 : null,
      myXp: idx >= 0 ? rows[idx].wxp : 0,
    };
  }

  const stats = db.prepare('SELECT COUNT(*) AS answers, COALESCE(SUM(correct),0) AS correct FROM attempts WHERE user_id = ?').get(u.id);
  const recentExams = db.prepare('SELECT id, topic_id, exam_title, score, ts FROM exam_results WHERE user_id = ? ORDER BY ts DESC LIMIT 5').all(u.id);

  res.json({
    user: meExtras(u),
    topics,
    week: days,
    leaderboard,
    stats: { answers: stats.answers, correct: stats.correct, solved: db.prepare('SELECT COUNT(*) AS c FROM solved WHERE user_id = ?').get(u.id).c },
    badges: getUserBadges(u.id),
    allBadges: BADGES,
    recentExams,
  });
});

app.get('/api/topics/:topicId', requireApprovedStudent, (req, res) => {
  const topic = topicForUser(req, res);
  if (!topic) return;
  const progress = topicProgress(req.user.id, topic);
  const exams = db.prepare('SELECT id, exam_id, score, correct, total, ts FROM exam_results WHERE user_id = ? AND topic_id = ? ORDER BY ts DESC')
    .all(req.user.id, topic.id);
  res.json({ topic: publicTopic(topic), progress, examResults: exams, preview: topic.status !== 'published' });
});

app.post('/api/topics/:topicId/practice/:qid/check', requireApprovedStudent, (req, res) => {
  const topic = topicForUser(req, res);
  if (!topic) return;
  const q = topic.practiceQuestions.find((x) => x.id === req.params.qid);
  if (!q) return bad(res, 'השאלה לא נמצאה (ייתכן שעודכנה). רעננו את הדף.', 404);
  const attempt = Math.max(1, Math.min(10, Number(req.body.attempt) || 1));
  const combo = Math.max(0, Math.min(100, Number(req.body.combo) || 0));
  const correct = checkAnswer(q, req.body.response);
  const isStudent = req.user.role === 'student';

  if (isStudent) {
    db.prepare('INSERT INTO attempts(user_id, topic_id, question_id, subtopic, correct, attempt_no, ts) VALUES(?,?,?,?,?,?,?)')
      .run(req.user.id, topic.id, q.id, q.subtopic, correct ? 1 : 0, attempt, now());
  }

  const out = { correct, attempt };
  if (correct) {
    out.explanation = q.explanation;
    if (isStudent) {
      const already = db.prepare('SELECT 1 FROM solved WHERE user_id = ? AND topic_id = ? AND question_id = ?').get(req.user.id, topic.id, q.id);
      let xp = 0;
      if (!already) {
        db.prepare('INSERT INTO solved(user_id, topic_id, question_id, ts) VALUES(?,?,?,?)').run(req.user.id, topic.id, q.id, now());
        xp = (attempt === 1 ? 10 : attempt === 2 ? 5 : 3) + (attempt === 1 ? Math.min(5, combo) : 0);
      }
      out.alreadySolved = !!already;
      const newCombo = attempt === 1 ? combo + 1 : 0;
      out.game = addXp(req.user.id, xp, { answered: 1 });
      out.game.newBadges.push(...checkPracticeBadges(req.user.id, newCombo, topic));
    }
  } else {
    if (isStudent) addXp(req.user.id, 0, { answered: 1 });
    if (attempt >= 2) {
      out.explanation = q.explanation;
      out.correctAnswer = displayAnswer(q);
      if (q.type === 'numberline') out.correctValue = Number(q.answer);
    } else {
      out.hint = q.hint || 'נסו לקרוא שוב את השאלה בעיון ולבדוק כל שלב בחישוב.';
    }
  }
  res.json(out);
});

app.post('/api/topics/:topicId/exams/:examId/start', requireApprovedStudent, (req, res) => {
  const topic = topicForUser(req, res);
  if (!topic) return;
  const exam = topic.exams.find((e) => e.id === req.params.examId);
  if (!exam || !exam.questions.length) return bad(res, 'המבחן לא נמצא', 404);
  const sid = uid('es-');
  const t = now();
  const deadline = exam.timeLimitMin ? t + exam.timeLimitMin * 60_000 : 0;
  db.prepare('INSERT INTO exam_sessions(id, user_id, topic_id, exam_id, started_at, deadline) VALUES(?,?,?,?,?,?)')
    .run(sid, req.user.id, topic.id, exam.id, t, deadline);
  // Retakes get a fresh option order (seeded by the session id).
  const previous = db.prepare('SELECT COUNT(*) AS c FROM exam_results WHERE user_id = ? AND exam_id = ? AND topic_id = ?').get(req.user.id, exam.id, topic.id).c;
  const seed = previous > 0 ? sid : '';
  const questions = exam.questions.map((q) => publicQuestion(q, seed));
  if (previous > 0) {
    // also shuffle question order on retakes
    for (let i = questions.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }
  }
  res.json({
    sessionId: sid, deadline, serverNow: t,
    exam: { id: exam.id, title: exam.title, description: exam.description, timeLimitMin: exam.timeLimitMin, questions },
  });
});

app.post('/api/exam-sessions/:sid/submit', requireApprovedStudent, (req, res) => {
  const s = db.prepare('SELECT * FROM exam_sessions WHERE id = ? AND user_id = ?').get(req.params.sid, req.user.id);
  if (!s) return bad(res, 'מפגש המבחן לא נמצא', 404);
  if (s.submitted) return bad(res, 'המבחן כבר הוגש', 409);
  const topic = getTopic(s.topic_id);
  const exam = topic?.exams.find((e) => e.id === s.exam_id);
  if (!exam) return bad(res, 'המבחן עודכן או נמחק. התחילו מחדש.', 410);

  const answers = req.body.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
  const late = s.deadline && now() > s.deadline + 30_000;
  const details = exam.questions.map((q) => {
    const given = answers[q.id];
    const ok = !late && given !== undefined && given !== '' && checkAnswer(q, given);
    return {
      id: q.id, type: q.type, prompt: q.prompt, given: given ?? null, correct: ok,
      correctAnswer: displayAnswer(q), explanation: q.explanation, options: q.options,
    };
  });
  const correct = details.filter((d) => d.correct).length;
  const score = Math.round((correct / exam.questions.length) * 100);
  const duration = Math.round((now() - s.started_at) / 1000);
  const rid = uid('res-');
  const isStudent = req.user.role === 'student';
  let game = null;
  tx(() => {
    db.prepare('UPDATE exam_sessions SET submitted = 1 WHERE id = ?').run(s.id);
    if (isStudent) {
      db.prepare(`INSERT INTO exam_results(id, user_id, topic_id, exam_id, exam_title, score, correct, total, details, duration_sec, ts)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(rid, req.user.id, topic.id, exam.id, exam.title, score, correct, exam.questions.length,
        JSON.stringify(details.map((d) => ({ id: d.id, given: d.given, correct: d.correct }))), duration, now());
    }
  });
  if (isStudent) {
    const firstTime = db.prepare('SELECT COUNT(*) AS c FROM exam_results WHERE user_id = ? AND exam_id = ? AND topic_id = ?').get(req.user.id, exam.id, topic.id).c === 1;
    const xp = Math.round(score / 4) + (score >= 90 ? 15 : 0);
    game = addXp(req.user.id, firstTime ? xp : Math.round(xp / 3), { answered: exam.questions.length });
    game.newBadges.push(...checkExamBadges(req.user.id, score));
  }
  res.json({ score, correct, total: exam.questions.length, duration, details, late: !!late, game });
});

// ================================================================ admin
const admin = express.Router();
admin.use(requireAdmin);

function studentStats(userId) {
  const a = db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(correct),0) AS c FROM attempts WHERE user_id = ?').get(userId);
  const e = db.prepare('SELECT COUNT(*) AS n, AVG(score) AS avg FROM exam_results WHERE user_id = ?').get(userId);
  const week = db.prepare('SELECT COALESCE(SUM(xp),0) AS xp, COALESCE(SUM(answers),0) AS answers FROM activity WHERE user_id = ? AND day >= ?')
    .get(userId, israelDay(Date.now() - 6 * 86400000));
  return {
    answers: a.n, accuracy: a.n ? Math.round((a.c / a.n) * 100) : null,
    exams: e.n, examAvg: e.avg === null ? null : Math.round(e.avg),
    weekXp: week.xp, weekAnswers: week.answers,
  };
}

function weakSpots(userId, minAttempts = 4) {
  return db.prepare(`SELECT topic_id, subtopic, COUNT(*) AS n, SUM(correct) AS c FROM attempts
    WHERE user_id = ? AND subtopic != '' GROUP BY topic_id, subtopic HAVING n >= ?`).all(userId, minAttempts)
    .map((r) => ({ topicId: r.topic_id, subtopic: r.subtopic, attempts: r.n, accuracy: Math.round((r.c / r.n) * 100) }))
    .filter((r) => r.accuracy < 60)
    .sort((x, y) => x.accuracy - y.accuracy);
}

admin.get('/overview', (req, res) => {
  const students = db.prepare("SELECT * FROM users WHERE role = 'student'").all();
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = israelDay(Date.now() - i * 86400000);
    const r = db.prepare("SELECT COUNT(DISTINCT a.user_id) AS active, COALESCE(SUM(a.answers),0) AS answers, COALESCE(SUM(a.xp),0) AS xp FROM activity a JOIN users u ON u.id = a.user_id WHERE a.day = ? AND u.role = 'student'").get(d);
    days.push({ day: d, ...r });
  }
  const weekAgo = israelDay(Date.now() - 6 * 86400000);
  const activeWeek = db.prepare("SELECT COUNT(DISTINCT a.user_id) AS c FROM activity a JOIN users u ON u.id=a.user_id WHERE a.day >= ? AND u.role='student'").get(weekAgo).c;
  const answersWeek = db.prepare("SELECT COALESCE(SUM(a.answers),0) AS c FROM activity a JOIN users u ON u.id=a.user_id WHERE a.day >= ? AND u.role='student'").get(weekAgo).c;
  const examAvg = db.prepare('SELECT AVG(score) AS a, COUNT(*) AS n FROM exam_results WHERE ts >= ?').get(Date.now() - 30 * 86400000);
  const topicTitles = Object.fromEntries(listTopics().map((t) => [t.id, t.title]));

  const attention = [];
  for (const s of students.filter((x) => x.status === 'approved')) {
    for (const w of weakSpots(s.id).slice(0, 2)) {
      attention.push({ studentId: s.id, name: s.name, ...w, topicTitle: topicTitles[w.topicId] || '' });
    }
  }
  attention.sort((a, b) => a.accuracy - b.accuracy);

  const inactive = students.filter((s) => s.status === 'approved' && (!s.last_active_day || s.last_active_day < israelDay(Date.now() - 7 * 86400000)))
    .map((s) => ({ id: s.id, name: s.name, phone: s.phone, lastActiveDay: s.last_active_day }));

  const recentExams = db.prepare(`SELECT r.id, r.score, r.exam_title, r.ts, r.topic_id, u.name, u.id AS user_id FROM exam_results r
    JOIN users u ON u.id = r.user_id ORDER BY r.ts DESC LIMIT 8`).all()
    .map((r) => ({ ...r, topicTitle: topicTitles[r.topic_id] || '' }));

  res.json({
    kpis: {
      students: students.filter((s) => s.status === 'approved').length,
      pending: students.filter((s) => s.status === 'pending').length,
      activeWeek, answersWeek,
      examAvg: examAvg.a === null ? null : Math.round(examAvg.a),
      examsMonth: examAvg.n,
      topics: db.prepare("SELECT COUNT(*) AS c FROM topics WHERE status='published'").get().c,
      drafts: db.prepare("SELECT COUNT(*) AS c FROM topics WHERE status='draft'").get().c,
    },
    days,
    attention: attention.slice(0, 12),
    inactive: inactive.slice(0, 12),
    recentExams,
    pending: students.filter((s) => s.status === 'pending').map(publicUser),
  });
});

admin.get('/students', (req, res) => {
  const rows = db.prepare("SELECT * FROM users WHERE role = 'student' ORDER BY created_at DESC").all();
  const topicTitles = Object.fromEntries(listTopics().map((t) => [t.id, t.title]));
  res.json({
    students: rows.map((u) => ({
      ...publicUser(u), streak: liveStreak(u), notes: u.notes,
      requestedTopic: u.requested_topic, requestedTopicTitle: topicTitles[u.requested_topic] || '',
      access: userAccess(u.id), stats: studentStats(u.id),
      devices: db.prepare('SELECT COUNT(*) AS c FROM sessions WHERE user_id = ?').get(u.id).c,
    })),
  });
});

admin.post('/students', (req, res) => {
  const name = clean(req.body.name, 80);
  const email = clean(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || '');
  if (name.length < 2) return bad(res, 'נא למלא שם');
  if (!emailOk(email)) return bad(res, 'אימייל לא תקין');
  if (password.length < 6) return bad(res, 'סיסמה של 6 תווים לפחות');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return bad(res, 'האימייל כבר קיים', 409);
  const id = uid('stu-');
  db.prepare(`INSERT INTO users(id, role, name, email, phone, password_hash, grade, level, program, status, created_at)
    VALUES(?, 'student', ?, ?, ?, ?, ?, ?, ?, 'approved', ?)`).run(id, name, email, clean(req.body.phone, 30), hashPassword(password),
    clean(req.body.grade, 40), clean(req.body.level, 40), clean(req.body.program, 60), now());
  if (req.body.grantGrade && clean(req.body.grade, 40)) {
    db.prepare('INSERT OR IGNORE INTO grade_access(user_id, grade) VALUES(?, ?)').run(id, clean(req.body.grade, 40));
  }
  res.json({ ok: true, id });
});

admin.get('/students/:id', (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'student'").get(req.params.id);
  if (!u) return bad(res, 'התלמיד לא נמצא', 404);
  const topics = listTopics();
  const titles = Object.fromEntries(topics.map((t) => [t.id, t.title]));
  const bySub = db.prepare(`SELECT topic_id, subtopic, COUNT(*) AS n, SUM(correct) AS c FROM attempts WHERE user_id = ?
    GROUP BY topic_id, subtopic ORDER BY topic_id`).all(u.id)
    .map((r) => ({ topicId: r.topic_id, topicTitle: titles[r.topic_id] || '', subtopic: r.subtopic || 'כללי', attempts: r.n, accuracy: Math.round((r.c / r.n) * 100) }));
  const exams = db.prepare('SELECT id, topic_id, exam_title, score, correct, total, duration_sec, ts FROM exam_results WHERE user_id = ? ORDER BY ts DESC').all(u.id)
    .map((r) => ({ ...r, topicTitle: titles[r.topic_id] || '' }));
  const progress = topics.map((t) => ({ topicId: t.id, title: t.title, ...topicProgress(u.id, t), solvedIds: undefined }))
    .filter((p) => p.solved > 0 || p.examsTaken > 0);
  const days = [];
  for (let i = 27; i >= 0; i--) {
    const d = israelDay(Date.now() - i * 86400000);
    const r = db.prepare('SELECT xp, answers FROM activity WHERE user_id = ? AND day = ?').get(u.id, d);
    days.push({ day: d, xp: r?.xp || 0, answers: r?.answers || 0 });
  }
  res.json({
    student: { ...publicUser(u), streak: liveStreak(u), notes: u.notes, levelInfo: levelInfo(u.xp) },
    access: userAccess(u.id), stats: studentStats(u.id), bySubtopic: bySub, exams, progress, days,
    badges: getUserBadges(u.id),
  });
});

admin.patch('/students/:id', (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'student'").get(req.params.id);
  if (!u) return bad(res, 'התלמיד לא נמצא', 404);
  const b = req.body || {};
  const next = {
    name: b.name !== undefined ? clean(b.name, 80) || u.name : u.name,
    email: b.email !== undefined ? clean(b.email, 160).toLowerCase() : u.email,
    phone: b.phone !== undefined ? clean(b.phone, 30) : u.phone,
    grade: b.grade !== undefined ? clean(b.grade, 40) : u.grade,
    level: b.level !== undefined ? clean(b.level, 40) : u.level,
    program: b.program !== undefined ? clean(b.program, 60) : u.program,
    notes: b.notes !== undefined ? clean(b.notes, 2000) : u.notes,
    status: ['pending', 'approved', 'blocked'].includes(b.status) ? b.status : u.status,
  };
  if (!emailOk(next.email)) return bad(res, 'אימייל לא תקין');
  if (next.email !== u.email && db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(next.email, u.id)) {
    return bad(res, 'האימייל כבר בשימוש', 409);
  }
  db.prepare('UPDATE users SET name=?, email=?, phone=?, grade=?, level=?, program=?, notes=?, status=? WHERE id=?')
    .run(next.name, next.email, next.phone, next.grade, next.level, next.program, next.notes, next.status, u.id);
  if (next.status === 'blocked') db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  res.json({ ok: true });
});

admin.put('/students/:id/access', (req, res) => {
  const u = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'student'").get(req.params.id);
  if (!u) return bad(res, 'התלמיד לא נמצא', 404);
  const grades = [...new Set((req.body.grades || []).map((g) => clean(g, 40)).filter(Boolean))];
  const validTopics = new Set(listTopics().map((t) => t.id));
  const topicIds = [...new Set((req.body.topicIds || []).map(String))].filter((id) => validTopics.has(id));
  tx(() => {
    db.prepare('DELETE FROM grade_access WHERE user_id = ?').run(u.id);
    db.prepare('DELETE FROM topic_access WHERE user_id = ?').run(u.id);
    for (const g of grades) db.prepare('INSERT INTO grade_access(user_id, grade) VALUES(?,?)').run(u.id, g);
    for (const t of topicIds) db.prepare('INSERT INTO topic_access(user_id, topic_id) VALUES(?,?)').run(u.id, t);
    if (req.body.approve) db.prepare("UPDATE users SET status = 'approved' WHERE id = ?").run(u.id);
  });
  res.json({ ok: true, access: userAccess(u.id) });
});

admin.post('/students/:id/reset-password', (req, res) => {
  const pw = String(req.body.password || '');
  if (pw.length < 6) return bad(res, 'סיסמה של 6 תווים לפחות');
  const r = db.prepare("UPDATE users SET password_hash = ? WHERE id = ? AND role = 'student'").run(hashPassword(pw), req.params.id);
  if (!r.changes) return bad(res, 'התלמיד לא נמצא', 404);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id);
  res.json({ ok: true });
});

admin.post('/students/:id/logout-all', (req, res) => {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id);
  res.json({ ok: true });
});

admin.delete('/students/:id', (req, res) => {
  tx(() => {
    db.prepare('DELETE FROM attempts WHERE user_id = ?').run(req.params.id);
    db.prepare('DELETE FROM exam_results WHERE user_id = ?').run(req.params.id);
    db.prepare("DELETE FROM users WHERE id = ? AND role = 'student'").run(req.params.id);
  });
  res.json({ ok: true });
});

// ---- topics
function topicSummary(t) {
  const accessCount = db.prepare(`SELECT COUNT(DISTINCT u.id) AS c FROM users u WHERE u.role='student' AND u.status='approved' AND (
    EXISTS (SELECT 1 FROM topic_access a WHERE a.user_id = u.id AND a.topic_id = ?)
    OR EXISTS (SELECT 1 FROM grade_access g WHERE g.user_id = u.id AND g.grade = ? AND ? != ''))`).get(t.id, t.grade, t.grade).c;
  const att = db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(correct),0) AS c FROM attempts WHERE topic_id = ?').get(t.id);
  return {
    id: t.id, title: t.title, grade: t.grade, level: t.level, description: t.description, badge: t.badge, color: t.color,
    status: t.status, aiGenerated: t.aiGenerated, updatedAt: t.updatedAt, createdAt: t.createdAt,
    counts: {
      sections: t.learnSections.length, practice: t.practiceQuestions.length, tips: t.tips.length,
      exams: t.exams.length, examQuestions: t.exams.reduce((s, e) => s + e.questions.length, 0),
    },
    accessCount,
    accuracy: att.n ? Math.round((att.c / att.n) * 100) : null,
    attempts: att.n,
  };
}

admin.get('/topics', (req, res) => res.json({ topics: listTopics().map(topicSummary) }));

admin.get('/topics/:id', (req, res) => {
  const t = getTopic(req.params.id);
  if (!t) return bad(res, 'הנושא לא נמצא', 404);
  res.json({ topic: t });
});

admin.post('/topics', (req, res) => {
  const b = req.body || {};
  const title = clean(b.title, 200);
  if (!title) return bad(res, 'נא לתת שם לנושא');
  const t = saveTopic({
    id: uid('topic-'), title, grade: clean(b.grade, 40), level: clean(b.level, 40), description: clean(b.description, 600),
    badge: clean(b.badge, 60), color: clean(b.color, 20), status: 'draft',
    ...(b.content && typeof b.content === 'object' ? b.content : {}),
  });
  res.json({ topic: t });
});

admin.post('/topics/import', (req, res) => {
  const raw = req.body?.topic;
  if (!raw || typeof raw !== 'object') return bad(res, 'קובץ JSON לא תקין');
  const t = saveTopic({ ...raw, id: uid('topic-'), title: clean(raw.title, 200) || 'נושא מיובא', status: 'draft' });
  res.json({ topic: t });
});

admin.put('/topics/:id', (req, res) => {
  const existing = getTopic(req.params.id);
  if (!existing) return bad(res, 'הנושא לא נמצא', 404);
  const b = req.body?.topic || {};
  const t = saveTopic({
    ...existing, ...b, id: existing.id,
    title: clean(b.title ?? existing.title, 200) || existing.title,
    grade: clean(b.grade ?? existing.grade, 40), level: clean(b.level ?? existing.level, 40),
    description: clean(b.description ?? existing.description, 600), badge: clean(b.badge ?? existing.badge, 60),
    color: clean(b.color ?? existing.color, 20),
  });
  res.json({ topic: t });
});

admin.post('/topics/:id/duplicate', (req, res) => {
  const t = getTopic(req.params.id);
  if (!t) return bad(res, 'הנושא לא נמצא', 404);
  const copy = saveTopic({ ...t, id: uid('topic-'), title: `${t.title} (עותק)`, status: 'draft' });
  res.json({ topic: copy });
});

admin.delete('/topics/:id', (req, res) => {
  tx(() => {
    db.prepare('DELETE FROM topics WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM solved WHERE topic_id = ?').run(req.params.id);
  });
  res.json({ ok: true });
});

admin.post('/topics/reorder', (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  tx(() => ids.forEach((id, i) => db.prepare('UPDATE topics SET sort = ? WHERE id = ?').run(i + 1, String(id))));
  res.json({ ok: true });
});

admin.get('/topics/:id/stats', (req, res) => {
  const t = getTopic(req.params.id);
  if (!t) return bad(res, 'הנושא לא נמצא', 404);
  const rows = db.prepare(`SELECT question_id, COUNT(*) AS n, SUM(correct) AS c, COUNT(DISTINCT user_id) AS users,
    SUM(CASE WHEN attempt_no = 1 AND correct = 1 THEN 1 ELSE 0 END) AS first
    FROM attempts WHERE topic_id = ? GROUP BY question_id`).all(t.id);
  const map = Object.fromEntries(rows.map((r) => [r.question_id, r]));
  res.json({
    questions: t.practiceQuestions.map((q, i) => {
      const r = map[q.id];
      return {
        id: q.id, index: i + 1, prompt: q.prompt, subtopic: q.subtopic, type: q.type,
        attempts: r?.n || 0, users: r?.users || 0, accuracy: r?.n ? Math.round((r.c / r.n) * 100) : null,
      };
    }),
  });
});

// ---- exams & analytics
admin.get('/exam-results', (req, res) => {
  const titles = Object.fromEntries(listTopics().map((t) => [t.id, t.title]));
  const rows = db.prepare(`SELECT r.id, r.user_id, r.topic_id, r.exam_id, r.exam_title, r.score, r.correct, r.total, r.duration_sec, r.ts, u.name, u.grade
    FROM exam_results r JOIN users u ON u.id = r.user_id ORDER BY r.ts DESC LIMIT 1000`).all();
  res.json({ results: rows.map((r) => ({ ...r, topicTitle: titles[r.topic_id] || '' })) });
});

// ---- AI studio
admin.post('/ai/generate', upload.array('files', 5), ah(async (req, res) => {
  const b = req.body || {};
  const sources = await collectSources({ files: req.files || [], url: b.url, text: b.text }).catch((e) => { throw Object.assign(e, { status: 400 }); });
  if (!sources.length) return bad(res, 'נא להעלות קובץ, להדביק קישור או לכתוב טקסט');
  const job = startGenerateJob({
    sources,
    opts: {
      title: clean(b.title, 200), grade: clean(b.grade, 40), level: clean(b.level, 40), color: clean(b.color, 20),
      practiceCount: Math.max(6, Math.min(50, Number(b.practiceCount) || 24)),
      examCount: Math.max(0, Math.min(4, Number(b.examCount ?? 2))),
      examSize: Math.max(4, Math.min(20, Number(b.examSize) || 8)),
      difficulty: ['easy', 'mixed', 'hard'].includes(b.difficulty) ? b.difficulty : 'mixed',
      instructions: clean(b.instructions, 2000),
    },
  });
  res.json({ job });
}));

admin.post('/ai/topics/:id/extend', (req, res) => {
  try {
    const kind = req.body.kind === 'exam' ? 'exam' : 'practice';
    const job = startExtendJob({
      topicId: req.params.id, kind,
      count: Math.max(3, Math.min(30, Number(req.body.count) || (kind === 'exam' ? 8 : 10))),
      instructions: clean(req.body.instructions, 1000),
    });
    res.json({ job });
  } catch (e) { bad(res, e.message); }
});

admin.get('/ai/jobs', (req, res) => res.json({ jobs: listJobs() }));
admin.get('/ai/jobs/:id', (req, res) => {
  const j = getJob(req.params.id);
  if (!j) return bad(res, 'לא נמצא', 404);
  res.json({ job: j });
});

// ---- uploads (images for content)
const imageUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => cb(null, uid('img-') + (path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.png')),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(png|jpe?g|gif|webp|svg\+xml)$/.test(file.mimetype)),
});
admin.post('/uploads', imageUpload.single('file'), (req, res) => {
  if (!req.file) return bad(res, 'נא לבחור תמונה (PNG/JPG/WebP/GIF/SVG)');
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ---- settings
const ADMIN_SETTING_KEYS = ['whatsappPhone', 'brandSubtitle', 'homeUrl', 'geminiApiKey', 'geminiModel', 'registrationOpen', 'showLeaderboard', 'dailyGoalXp', 'grades', 'levels', 'programs'];
admin.get('/settings', (req, res) => {
  const s = getAllSettings();
  const key = s.geminiApiKey || '';
  res.json({
    settings: {
      ...s, geminiApiKey: '', geminiKeySet: !!key, geminiKeyHint: key ? `••••${key.slice(-4)}` : '',
      grades: getJsonSetting('grades'), levels: getJsonSetting('levels'), programs: getJsonSetting('programs'),
      registrationOpen: s.registrationOpen === 'true', showLeaderboard: s.showLeaderboard === 'true',
    },
    admin: publicUser(req.user),
  });
});

admin.put('/settings', (req, res) => {
  const b = req.body || {};
  for (const k of ADMIN_SETTING_KEYS) {
    if (b[k] === undefined) continue;
    if (k === 'geminiApiKey') {
      if (b.clearGeminiKey) setSetting(k, '');
      else if (String(b[k]).trim()) setSetting(k, String(b[k]).trim());
      continue;
    }
    if (['grades', 'levels', 'programs'].includes(k)) {
      const list = (Array.isArray(b[k]) ? b[k] : []).map((x) => clean(x, 40)).filter(Boolean);
      if (list.length) setSetting(k, JSON.stringify([...new Set(list)]));
      continue;
    }
    if (['registrationOpen', 'showLeaderboard'].includes(k)) { setSetting(k, b[k] ? 'true' : 'false'); continue; }
    if (k === 'dailyGoalXp') { setSetting(k, String(Math.max(10, Math.min(500, Number(b[k]) || 60)))); continue; }
    if (k === 'whatsappPhone') { setSetting(k, digits(b[k]).replace(/^0/, '972')); continue; }
    setSetting(k, clean(b[k], 300));
  }
  if (b.clearGeminiKey) setSetting('geminiApiKey', '');
  res.json({ ok: true });
});

admin.post('/settings/test-ai', ah(async (req, res) => {
  try {
    const { reply, model } = await testGemini({ apiKey: String(req.body.apiKey || '').trim() || undefined, model: clean(req.body.model, 80) || undefined });
    res.json({ ok: true, reply, model });
  } catch (e) { res.json({ ok: false, error: e.message }); }
}));

admin.post('/settings/ai-models', ah(async (req, res) => {
  try {
    const models = await listGeminiModels(String(req.body.apiKey || '').trim() || undefined);
    const best = pickBestModel(models);
    res.json({ ok: true, models, recommended: best?.id || '' });
  } catch (e) { res.json({ ok: false, error: e.message, models: [] }); }
}));

admin.put('/account', (req, res) => {
  const b = req.body || {};
  if (!verifyPassword(b.current, req.user.password_hash)) return bad(res, 'הסיסמה הנוכחית שגויה');
  const email = b.email !== undefined ? clean(b.email, 160).toLowerCase() : req.user.email;
  if (!emailOk(email)) return bad(res, 'אימייל לא תקין');
  if (email !== req.user.email && db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(email, req.user.id)) return bad(res, 'האימייל בשימוש', 409);
  const name = clean(b.name, 80) || req.user.name;
  db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email, req.user.id);
  if (b.next) {
    if (String(b.next).length < 8) return bad(res, 'סיסמת מנהלת צריכה 8 תווים לפחות');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(b.next), req.user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(req.user.id, req.sessionToken);
  }
  res.json({ ok: true });
});

admin.get('/backup', (req, res) => {
  const payload = {
    exportedAt: new Date().toISOString(),
    topics: listTopics(),
    students: db.prepare("SELECT * FROM users WHERE role='student'").all().map((u) => ({ ...publicUser(u), access: userAccess(u.id) })),
    examResults: db.prepare('SELECT * FROM exam_results').all(),
  };
  res.setHeader('Content-Disposition', `attachment; filename="adi-math-backup-${israelDay()}.json"`);
  res.json(payload);
});

app.use('/api/admin', admin);

// Preview: admin can open any topic (incl. drafts) through the student endpoints — handled by accessibleTopicIds.

app.use('/api', (req, res) => bad(res, 'נתיב לא קיים', 404));

// ================================================================ static
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '30d', setHeaders: (res) => res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'") }));
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h', setHeaders: (res, p) => { if (p.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); } }));
  app.get('*', (req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
} else {
  app.get('/', (req, res) => res.send('Client not built. Run: npm run build'));
}

// ================================================================ errors
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return bad(res, err.code === 'LIMIT_FILE_SIZE' ? 'הקובץ גדול מדי (עד 18MB)' : 'שגיאה בהעלאת הקובץ');
  }
  if (err.type === 'entity.too.large') return bad(res, 'הנתונים גדולים מדי', 413);
  if (err.status === 400) return bad(res, err.message);
  console.error(err);
  bad(res, 'שגיאת שרת. נסו שוב.', 500);
});

const PORT = Number(process.env.PORT || 3000);
if (process.env.NODE_ENV !== 'test-import') {
  app.listen(PORT, () => console.log(`✓ עדי - בית למתמטיקה running on http://localhost:${PORT}`));
}
export default app;

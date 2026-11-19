// SQLite persistence layer (Node's built-in node:sqlite — no native deps).
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeTopicContent } from './content.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'adi-math.db');
export const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'student',
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  grade TEXT DEFAULT '',
  level TEXT DEFAULT '',
  program TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  xp INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  last_active_day TEXT DEFAULT '',
  last_seen INTEGER DEFAULT 0,
  avatar TEXT DEFAULT '',
  requested_topic TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  grade TEXT DEFAULT '',
  level TEXT DEFAULT '',
  description TEXT DEFAULT '',
  badge TEXT DEFAULT '',
  color TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  content TEXT NOT NULL DEFAULT '{}',
  ai_generated INTEGER DEFAULT 0,
  sort INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS topic_access (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, topic_id)
);
CREATE TABLE IF NOT EXISTS grade_access (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grade TEXT NOT NULL,
  PRIMARY KEY (user_id, grade)
);
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  subtopic TEXT DEFAULT '',
  correct INTEGER NOT NULL,
  attempt_no INTEGER NOT NULL DEFAULT 1,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id, topic_id);
CREATE TABLE IF NOT EXISTS solved (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  PRIMARY KEY (user_id, topic_id, question_id)
);
CREATE TABLE IF NOT EXISTS exam_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  exam_title TEXT DEFAULT '',
  score INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  total INTEGER NOT NULL,
  details TEXT NOT NULL DEFAULT '[]',
  duration_sec INTEGER DEFAULT 0,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exam_user ON exam_results(user_id);
CREATE TABLE IF NOT EXISTS exam_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  deadline INTEGER DEFAULT 0,
  submitted INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS activity (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  answers INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
CREATE TABLE IF NOT EXISTS badges (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  PRIMARY KEY (user_id, badge_id)
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  stage TEXT DEFAULT '',
  error TEXT DEFAULT '',
  topic_id TEXT DEFAULT '',
  source_name TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`);

// ---------- helpers ----------
export const now = () => Date.now();
export const uid = (prefix = '') =>
  prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function israelDay(ts = Date.now()) {
  // Day key in Israel time so streaks roll over at local midnight.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(ts));
}

export function tx(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// ---------- settings ----------
const DEFAULT_SETTINGS = {
  whatsappPhone: '972522692230',
  brandSubtitle: 'כפר סבא',
  homeUrl: 'https://adi-math-home.netlify.app',
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  registrationOpen: 'true',
  showLeaderboard: 'true',
  dailyGoalXp: '60',
  grades: JSON.stringify(["כיתה ה'", "כיתה ו'", "כיתה ז'", "כיתה ח'", "כיתה ט'", "כיתה י'", "כיתה י\"א", "כיתה י\"ב", 'מרתונים']),
  levels: JSON.stringify(['ללא הקבצה', 'הקבצה א\'', 'הקבצה ב\'', '3 יח"ל', '4 יח"ל', '5 יח"ל']),
  programs: JSON.stringify(['שיעור פרטי', 'קבוצת למידה', 'מרתון הכנה למבחן']),
};

export function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (row) return row.value;
  if (key === 'geminiApiKey' && process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  return DEFAULT_SETTINGS[key] ?? '';
}
export function setSetting(key, value) {
  db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value));
}
export function getAllSettings() {
  const out = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) out[k] = getSetting(k);
  return out;
}
export function getJsonSetting(key) {
  try { return JSON.parse(getSetting(key)); } catch { return []; }
}

// ---------- topics ----------
export function rowToTopic(row) {
  if (!row) return null;
  let content = {};
  try { content = JSON.parse(row.content || '{}'); } catch { content = {}; }
  return {
    id: row.id,
    title: row.title,
    grade: row.grade,
    level: row.level,
    description: row.description,
    badge: row.badge,
    color: row.color,
    status: row.status,
    aiGenerated: !!row.ai_generated,
    sort: row.sort,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...normalizeTopicContent(content),
  };
}

export function getTopic(id) {
  return rowToTopic(db.prepare('SELECT * FROM topics WHERE id = ?').get(id));
}

export function listTopics() {
  return db.prepare('SELECT * FROM topics ORDER BY sort ASC, created_at ASC').all().map(rowToTopic);
}

export function saveTopic(topic, { aiGenerated } = {}) {
  const content = normalizeTopicContent(topic);
  const existing = db.prepare('SELECT id, created_at, sort, ai_generated FROM topics WHERE id = ?').get(topic.id);
  const t = now();
  if (existing) {
    db.prepare(`UPDATE topics SET title=?, grade=?, level=?, description=?, badge=?, color=?, status=?, content=?, updated_at=? WHERE id=?`)
      .run(String(topic.title || 'נושא ללא שם'), String(topic.grade || ''), String(topic.level || ''),
        String(topic.description || ''), String(topic.badge || ''), String(topic.color || ''),
        topic.status === 'published' ? 'published' : 'draft', JSON.stringify(content), t, topic.id);
  } else {
    const maxSort = db.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM topics').get().m;
    db.prepare(`INSERT INTO topics(id, title, grade, level, description, badge, color, status, content, ai_generated, sort, created_at, updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(topic.id, String(topic.title || 'נושא ללא שם'), String(topic.grade || ''), String(topic.level || ''),
        String(topic.description || ''), String(topic.badge || ''), String(topic.color || ''),
        topic.status === 'published' ? 'published' : 'draft', JSON.stringify(content), aiGenerated ? 1 : 0,
        maxSort + 1, t, t);
  }
  return getTopic(topic.id);
}

// ---------- seed ----------
export function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM topics').get().c;
  if (count > 0) return;
  const seedPath = path.join(__dirname, 'seed', 'directed-numbers.json');
  if (!fs.existsSync(seedPath)) return;
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  saveTopic({ ...seed, id: seed.id || 'topic-directed-numbers', status: 'published', color: 'sky' });
}

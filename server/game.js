// Gamification: XP, levels, daily streaks, daily goal and badges.
import { db, israelDay, now, getSetting } from './db.js';

export const LEVELS = [
  { min: 0, name: 'צעד ראשון', emoji: '🌱' },
  { min: 60, name: 'סקרן/ית', emoji: '🔍' },
  { min: 150, name: 'מתאמן/ת', emoji: '✏️' },
  { min: 300, name: 'פותר/ת בעיות', emoji: '🧩' },
  { min: 500, name: 'אלוף/ת תרגילים', emoji: '⚡' },
  { min: 800, name: 'מומחה/ית', emoji: '🎯' },
  { min: 1200, name: 'מאסטר/ית', emoji: '🏅' },
  { min: 1700, name: 'גאון/ית המספרים', emoji: '🧠' },
  { min: 2400, name: 'אגדה', emoji: '👑' },
  { min: 3300, name: 'בית המתמטיקה', emoji: '🏆' },
];

export function levelInfo(xp) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].min) idx = i;
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1];
  return {
    level: idx + 1,
    name: cur.name,
    emoji: cur.emoji,
    min: cur.min,
    next: next ? next.min : null,
    progress: next ? (xp - cur.min) / (next.min - cur.min) : 1,
  };
}

export const BADGES = [
  { id: 'first-correct', name: 'הצעד הראשון', desc: 'תשובה נכונה ראשונה', emoji: '🎉' },
  { id: 'correct-25', name: 'מתחממים', desc: '25 תשובות נכונות', emoji: '🔥' },
  { id: 'correct-100', name: 'מכונת תרגול', desc: '100 תשובות נכונות', emoji: '🚀' },
  { id: 'correct-300', name: 'בלתי ניתן לעצירה', desc: '300 תשובות נכונות', emoji: '🌋' },
  { id: 'combo-5', name: 'קומבו x5', desc: '5 תשובות נכונות ברצף', emoji: '⚡' },
  { id: 'combo-10', name: 'קומבו x10', desc: '10 תשובות נכונות ברצף', emoji: '💥' },
  { id: 'streak-3', name: '3 ימים ברצף', desc: 'תרגול 3 ימים רצופים', emoji: '📅' },
  { id: 'streak-7', name: 'שבוע מושלם', desc: 'תרגול 7 ימים רצופים', emoji: '🗓️' },
  { id: 'streak-14', name: 'הרגל של אלופים', desc: 'תרגול 14 ימים רצופים', emoji: '💎' },
  { id: 'first-exam', name: 'נבחן/ת אמיץ/ה', desc: 'הגשת מבחן ראשון', emoji: '📝' },
  { id: 'exam-90', name: 'מצטיינ/ת', desc: 'ציון 90 ומעלה במבחן', emoji: '🌟' },
  { id: 'exam-100', name: 'מאה עגול!', desc: 'ציון 100 במבחן', emoji: '💯' },
  { id: 'topic-master', name: 'כובש/ת נושא', desc: 'פתרון כל שאלות התרגול בנושא', emoji: '🏔️' },
  { id: 'daily-goal', name: 'יעד יומי', desc: 'השלמת היעד היומי', emoji: '🎯' },
];
const BADGE_MAP = Object.fromEntries(BADGES.map((b) => [b.id, b]));

export function getUserBadges(userId) {
  return db.prepare('SELECT badge_id, ts FROM badges WHERE user_id = ? ORDER BY ts ASC').all(userId)
    .filter((r) => BADGE_MAP[r.badge_id])
    .map((r) => ({ ...BADGE_MAP[r.badge_id], ts: r.ts }));
}

function award(userId, badgeId, out) {
  const r = db.prepare('INSERT OR IGNORE INTO badges(user_id, badge_id, ts) VALUES(?,?,?)').run(userId, badgeId, now());
  if (r.changes) out.push(BADGE_MAP[badgeId]);
}

function yesterdayOf(day) {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function dailyGoal() {
  return Math.max(10, Number(getSetting('dailyGoalXp')) || 60);
}

/** Adds XP, updates the streak and activity log. Returns a gamification event payload. */
export function addXp(userId, amount, { answered = 0 } = {}) {
  const user = db.prepare('SELECT xp, streak, best_streak, last_active_day FROM users WHERE id = ?').get(userId);
  if (!user) return null;
  const today = israelDay();
  const beforeLevel = levelInfo(user.xp).level;

  let streak = user.streak;
  if (user.last_active_day !== today) {
    streak = user.last_active_day === yesterdayOf(today) ? user.streak + 1 : 1;
  }
  const best = Math.max(user.best_streak, streak);
  const xp = user.xp + Math.max(0, amount);
  db.prepare('UPDATE users SET xp = ?, streak = ?, best_streak = ?, last_active_day = ? WHERE id = ?')
    .run(xp, streak, best, today, userId);

  const prevToday = db.prepare('SELECT xp FROM activity WHERE user_id = ? AND day = ?').get(userId, today)?.xp || 0;
  db.prepare(`INSERT INTO activity(user_id, day, xp, answers) VALUES(?,?,?,?)
    ON CONFLICT(user_id, day) DO UPDATE SET xp = xp + excluded.xp, answers = answers + excluded.answers`)
    .run(userId, today, Math.max(0, amount), answered);

  const newBadges = [];
  if (streak >= 3) award(userId, 'streak-3', newBadges);
  if (streak >= 7) award(userId, 'streak-7', newBadges);
  if (streak >= 14) award(userId, 'streak-14', newBadges);
  const goal = dailyGoal();
  const todayXp = prevToday + Math.max(0, amount);
  if (prevToday < goal && todayXp >= goal) award(userId, 'daily-goal', newBadges);

  const lvl = levelInfo(xp);
  return {
    xpGained: Math.max(0, amount),
    xp,
    streak,
    todayXp,
    dailyGoal: goal,
    dailyGoalReached: prevToday < goal && todayXp >= goal,
    level: lvl,
    levelUp: lvl.level > beforeLevel,
    newBadges,
  };
}

export function checkPracticeBadges(userId, combo, topic) {
  const out = [];
  const correct = db.prepare('SELECT COUNT(*) AS c FROM solved WHERE user_id = ?').get(userId).c;
  if (correct >= 1) award(userId, 'first-correct', out);
  if (correct >= 25) award(userId, 'correct-25', out);
  if (correct >= 100) award(userId, 'correct-100', out);
  if (correct >= 300) award(userId, 'correct-300', out);
  if (combo >= 5) award(userId, 'combo-5', out);
  if (combo >= 10) award(userId, 'combo-10', out);
  if (topic && topic.practiceQuestions.length >= 5) {
    const solvedInTopic = db.prepare('SELECT COUNT(*) AS c FROM solved WHERE user_id = ? AND topic_id = ?').get(userId, topic.id).c;
    const ids = new Set(topic.practiceQuestions.map((q) => q.id));
    if (solvedInTopic >= ids.size) award(userId, 'topic-master', out);
  }
  return out;
}

export function checkExamBadges(userId, score) {
  const out = [];
  award(userId, 'first-exam', out);
  if (score >= 90) award(userId, 'exam-90', out);
  if (score >= 100) award(userId, 'exam-100', out);
  return out;
}

export function todayXp(userId) {
  return db.prepare('SELECT xp FROM activity WHERE user_id = ? AND day = ?').get(userId, israelDay())?.xp || 0;
}

/** Current streak as displayed (resets to 0 if the student missed yesterday). */
export function liveStreak(user) {
  const today = israelDay();
  if (user.last_active_day === today || user.last_active_day === yesterdayOf(today)) return user.streak;
  return 0;
}

// End-to-end API tests. Spins up a real server on a temp database with the AI in mock mode.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'adi-test-'));
let server;

class Client {
  constructor() { this.cookie = ''; }
  async req(method, url, body, { csrf = true, form } = {}) {
    const headers = {};
    if (csrf) headers['X-Requested-With'] = 'adi-math';
    if (this.cookie) headers.Cookie = this.cookie;
    let payload;
    if (form) payload = form;
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const r = await fetch(BASE + url, { method, headers, body: payload });
    const set = r.headers.get('set-cookie');
    if (set) {
      const m = set.match(/adi_sid=([^;]*)/);
      if (m) this.cookie = m[1] ? `adi_sid=${m[1]}` : '';
    }
    const data = await r.json().catch(() => ({}));
    return { status: r.status, data };
  }
  get(u) { return this.req('GET', u); }
  post(u, b = {}, o) { return this.req('POST', u, b, o); }
  put(u, b = {}) { return this.req('PUT', u, b); }
  patch(u, b = {}) { return this.req('PATCH', u, b); }
  del(u) { return this.req('DELETE', u); }
}

const admin = new Client();
const student = new Client();
let studentId;
const TOPIC = 'topic-directed-numbers';

async function waitFor(fn, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if (await fn()) return true; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('timeout');
}

before(async () => {
  server = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR, AI_MOCK: '1', GEMINI_API_KEY: 'mock-key' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
  await waitFor(async () => (await fetch(`${BASE}/api/bootstrap`)).ok);
});

after(() => {
  server?.kill();
  try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch { /* windows lock */ }
});

test('first run requires setup, then locks', async () => {
  const b = await admin.get('/api/bootstrap');
  assert.equal(b.data.needsSetup, true);
  assert.equal((await admin.post('/api/setup', { name: 'עדי', email: 'adi@test.com', password: 'short' })).status, 400);
  const r = await admin.post('/api/setup', { name: 'עדי', email: 'adi@test.com', password: 'supersecret1' });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.role, 'admin');
  assert.equal((await new Client().post('/api/setup', { name: 'x', email: 'x@x.com', password: 'supersecret1' })).status, 409);
});

test('CSRF header is required for mutations', async () => {
  const r = await admin.req('POST', '/api/admin/topics', { title: 'x' }, { csrf: false });
  assert.equal(r.status, 403);
});

test('student registers and is pending', async () => {
  assert.equal((await student.post('/api/auth/register', { name: 'נועה כהן', phone: '050-1234567', email: 'bad', password: '123456' })).status, 400);
  const r = await student.post('/api/auth/register', { name: 'נועה כהן', phone: '050-1234567', email: 'Noa@Test.com', password: '123456', grade: "כיתה ז'", requestedTopic: TOPIC });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.status, 'pending');
  studentId = r.data.user.id;
  assert.equal((await student.get('/api/me/dashboard')).status, 403);
  assert.equal((await new Client().post('/api/auth/register', { name: 'כפול', phone: '0501111111', email: 'noa@test.com', password: '123456' })).status, 409);
});

test('students cannot reach admin API', async () => {
  assert.equal((await student.get('/api/admin/students')).status, 403);
  assert.equal((await new Client().get('/api/admin/students')).status, 401);
});

test('login by email or phone; wrong password rejected', async () => {
  const c = new Client();
  assert.equal((await c.post('/api/auth/login', { identifier: 'noa@test.com', password: 'nope' })).status, 401);
  assert.equal((await c.post('/api/auth/login', { identifier: '+972-50-123-4567', password: '123456' })).status, 200);
});

test('admin approves with grade access → student sees seeded topic', async () => {
  const list = await admin.get('/api/admin/students');
  const s = list.data.students.find((x) => x.id === studentId);
  assert.equal(s.requestedTopic, TOPIC);
  const r = await admin.put(`/api/admin/students/${studentId}/access`, { grades: ["כיתה ז'"], topicIds: [], approve: true });
  assert.equal(r.status, 200);
  const d = await student.get('/api/me/dashboard');
  assert.equal(d.status, 200);
  assert.equal(d.data.topics.length, 1);
  assert.equal(d.data.topics[0].id, TOPIC);
  assert.equal(d.data.topics[0].total, 32);
});

test('student topic payload never leaks answers', async () => {
  const r = await student.get(`/api/topics/${TOPIC}`);
  assert.equal(r.status, 200);
  for (const q of r.data.topic.practiceQuestions) {
    assert.equal(q.answer, undefined);
    assert.equal(q.explanation, undefined);
    assert.equal(q.acceptedAnswers, undefined);
  }
  assert.equal(r.data.topic.exams[0].questions, undefined);
  assert.equal(r.data.topic.exams.length, 4);
});

test('practice: correct, repeat, input normalization, hint then reveal', async () => {
  const url = (q) => `/api/topics/${TOPIC}/practice/${q}/check`;
  let r = await student.post(url('q2'), { response: '$0$', attempt: 1, combo: 0 });
  assert.equal(r.data.correct, true);
  assert.equal(r.data.game.xpGained, 10);
  r = await student.post(url('q2'), { response: '$0$', attempt: 1, combo: 1 });
  assert.equal(r.data.alreadySolved, true);
  assert.equal(r.data.game.xpGained, 0);
  r = await student.post(url('q8'), { response: '−5', attempt: 1, combo: 1 }); // unicode minus
  assert.equal(r.data.correct, true);
  assert.equal(r.data.game.xpGained, 11); // 10 + combo bonus 1
  r = await student.post(url('q1'), { response: '3', attempt: 1 });
  assert.equal(r.data.correct, false);
  assert.ok(r.data.hint);
  assert.equal(r.data.correctAnswer, undefined);
  r = await student.post(url('q1'), { response: '4', attempt: 2 });
  assert.equal(r.data.correct, false);
  assert.ok(r.data.correctAnswer);
  assert.equal(r.data.correctValue, -2);
  r = await student.post(url('q-nope'), { response: '1', attempt: 1 });
  assert.equal(r.status, 404);
  const d = await student.get('/api/me/dashboard');
  assert.equal(d.data.user.xp, 21);
  assert.equal(d.data.user.streak, 1);
  assert.ok(d.data.badges.some((b) => b.id === 'first-correct'));
});

test('exam: start hides answers, grading is server-side, no double submit', async () => {
  const s = await student.post(`/api/topics/${TOPIC}/exams/exam-1/start`);
  assert.equal(s.status, 200);
  for (const q of s.data.exam.questions) assert.equal(q.answer, undefined);
  const full = await admin.get(`/api/admin/topics/${TOPIC}`);
  const exam = full.data.topic.exams.find((e) => e.id === 'exam-1');
  const answers = Object.fromEntries(exam.questions.map((q) => [q.id, q.answer]));
  answers[exam.questions[0].id] = 'wrong';
  const r = await student.post(`/api/exam-sessions/${s.data.sessionId}/submit`, { answers });
  assert.equal(r.status, 200);
  assert.equal(r.data.correct, exam.questions.length - 1);
  assert.equal(r.data.score, Math.round(((exam.questions.length - 1) / exam.questions.length) * 100));
  assert.equal((await student.post(`/api/exam-sessions/${s.data.sessionId}/submit`, { answers })).status, 409);
  // another student's session can't be submitted by someone else
  const other = await admin.post(`/api/exam-sessions/${s.data.sessionId}/submit`, { answers });
  assert.equal(other.status, 404);
});

test('drafts and other grades stay hidden', async () => {
  const t = await admin.post('/api/admin/topics', { title: 'משוואות', grade: "כיתה ח'" });
  const id = t.data.topic.id;
  assert.equal((await student.get(`/api/topics/${id}`)).status, 403);
  await admin.put(`/api/admin/topics/${id}`, { topic: { status: 'published' } });
  assert.equal((await student.get(`/api/topics/${id}`)).status, 403); // wrong grade
  await admin.put(`/api/admin/students/${studentId}/access`, { grades: ["כיתה ז'"], topicIds: [id] });
  assert.equal((await student.get(`/api/topics/${id}`)).status, 200);
  await admin.put(`/api/admin/topics/${id}`, { topic: { status: 'draft' } });
  assert.equal((await student.get(`/api/topics/${id}`)).status, 403); // drafts never visible
  assert.equal((await admin.get(`/api/topics/${id}`)).status, 200); // admin preview works
});

test('AI studio (mock) builds a draft topic and can extend it', async () => {
  const fd = new FormData();
  fd.append('text', 'חזקות ושורשים לכיתה ח');
  fd.append('title', 'חזקות');
  fd.append('grade', "כיתה ח'");
  const r = await admin.req('POST', '/api/admin/ai/generate', undefined, { form: fd });
  assert.equal(r.status, 200);
  let job;
  await waitFor(async () => { job = (await admin.get(`/api/admin/ai/jobs/${r.data.job.id}`)).data.job; return job.status !== 'running'; });
  assert.equal(job.status, 'done', job.error);
  const t = (await admin.get(`/api/admin/topics/${job.topicId}`)).data.topic;
  assert.equal(t.status, 'draft');
  assert.equal(t.title, 'חזקות');
  assert.ok(t.practiceQuestions.some((q) => q.type === 'order'));
  assert.ok(t.practiceQuestions.some((q) => q.type === 'match'));
  const before = t.practiceQuestions.length;
  const ext = await admin.post(`/api/admin/ai/topics/${t.id}/extend`, { kind: 'practice', count: 3 });
  await waitFor(async () => (await admin.get(`/api/admin/ai/jobs/${ext.data.job.id}`)).data.job.status === 'done');
  const t2 = (await admin.get(`/api/admin/topics/${t.id}`)).data.topic;
  assert.equal(t2.practiceQuestions.length, before + 3);
  assert.equal(new Set(t2.practiceQuestions.map((q) => q.id)).size, t2.practiceQuestions.length);
  // empty request is rejected
  const bad = await admin.req('POST', '/api/admin/ai/generate', undefined, { form: new FormData() });
  assert.equal(bad.status, 400);
});

test('order & match questions are graded correctly', async () => {
  const t = await admin.post('/api/admin/topics', {
    title: 'בדיקה', grade: "כיתה ז'",
    content: {
      practiceQuestions: [
        { id: 'o1', type: 'order', prompt: 'סדרו', items: ['$-3$', '$0$', '$2$'] },
        { id: 'm1', type: 'match', prompt: 'התאימו', pairs: [{ left: 'a', right: '1' }, { left: 'b', right: '2' }] },
        { id: 'f1', type: 'input', prompt: 'שבר', answer: '3/4' },
      ],
    },
  });
  const id = t.data.topic.id;
  await admin.put(`/api/admin/topics/${id}`, { topic: { status: 'published' } });
  const view = await student.get(`/api/topics/${id}`);
  const o = view.data.topic.practiceQuestions.find((q) => q.id === 'o1');
  assert.notDeepEqual(o.items, ['$-3$', '$0$', '$2$']); // shuffled
  const chk = (qid, response) => student.post(`/api/topics/${id}/practice/${qid}/check`, { response, attempt: 1 });
  assert.equal((await chk('o1', ['$-3$', '$0$', '$2$'])).data.correct, true);
  assert.equal((await chk('m1', ['2', '1'])).data.correct, false);
  assert.equal((await chk('m1', ['1', '2'])).data.correct, true);
  assert.equal((await chk('f1', '0.75')).data.correct, true);
  assert.equal((await chk('f1', '6/8')).data.correct, true);
});

test('device limit keeps only 2 sessions per student', async () => {
  const devices = [new Client(), new Client(), new Client()];
  for (const d of devices) assert.equal((await d.post('/api/auth/login', { identifier: 'noa@test.com', password: '123456' })).status, 200);
  assert.equal((await devices[2].get('/api/me/dashboard')).status, 200);
  assert.equal((await devices[0].get('/api/me/dashboard')).status, 401);
});

test('admin overview, stats, results, settings', async () => {
  const o = await admin.get('/api/admin/overview');
  assert.equal(o.status, 200);
  assert.ok(o.data.kpis.students >= 1);
  assert.equal((await admin.get(`/api/admin/topics/${TOPIC}/stats`)).status, 200);
  assert.ok((await admin.get('/api/admin/exam-results')).data.results.length >= 1);
  assert.equal((await admin.get(`/api/admin/students/${studentId}`)).status, 200);
  await admin.put('/api/admin/settings', { whatsappPhone: '052-111-2233', registrationOpen: false, grades: ["כיתה ז'", "כיתה ח'"] });
  const b = await new Client().get('/api/bootstrap');
  assert.equal(b.data.settings.whatsappPhone, '972521112233');
  assert.equal(b.data.settings.registrationOpen, false);
  assert.equal((await new Client().post('/api/auth/register', { name: 'חדש', phone: '0509999999', email: 'n@n.com', password: '123456' })).status, 403);
  const s = await admin.get('/api/admin/settings');
  assert.equal(s.data.settings.geminiApiKey, ''); // never returned
  await admin.put('/api/admin/settings', { registrationOpen: true });
});

test('blocking a student kills sessions and blocks login', async () => {
  await admin.patch(`/api/admin/students/${studentId}`, { status: 'blocked' });
  assert.equal((await student.get('/api/me/dashboard')).status, 401);
  assert.equal((await new Client().post('/api/auth/login', { identifier: 'noa@test.com', password: '123456' })).status, 403);
  await admin.patch(`/api/admin/students/${studentId}`, { status: 'approved' });
});

test('password reset and deletion', async () => {
  await admin.post(`/api/admin/students/${studentId}/reset-password`, { password: 'newpass1' });
  const c = new Client();
  assert.equal((await c.post('/api/auth/login', { identifier: 'noa@test.com', password: 'newpass1' })).status, 200);
  assert.equal((await admin.del(`/api/admin/students/${studentId}`)).status, 200);
  assert.equal((await c.get('/api/me/dashboard')).status, 401);
});

test('SPA fallback and unknown API route', async () => {
  const r = await fetch(`${BASE}/topic/anything`);
  assert.equal(r.status, 200);
  assert.equal((await admin.get('/api/nope')).status, 404);
});

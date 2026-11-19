// Unit tests for content normalization, answer checking and AI-output repair.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'adi-unit-'));
const { normalizeTopicContent, checkAnswer, answersEqual, publicQuestion } = await import('../server/content.js');
const { repairLatexEscapes } = await import('../server/ai.js');

test('answersEqual handles common student formats', () => {
  assert.ok(answersEqual('-5', '−5'));
  assert.ok(answersEqual(' -5 ', '-5'));
  assert.ok(answersEqual('0.75', '3/4'));
  assert.ok(answersEqual('3/4', '0.75'));
  assert.ok(answersEqual('-3/4', '-0.75'));
  assert.ok(answersEqual('2,5', '2.5'));
  assert.ok(answersEqual('$-17$', '-17'));
  assert.ok(answersEqual('x=4', '4'));
  assert.ok(answersEqual('2X+1', '2x+1'));
  assert.ok(!answersEqual('5', '-5'));
  assert.ok(!answersEqual('', '0'));
  assert.ok(!answersEqual('1/0', '0'));
});

test('messy AI output is normalized safely', () => {
  const c = normalizeTopicContent({
    learnSections: [{ title: 'פרק', bullets: 'not-array', workedExample: { problem: '', steps: [] } }],
    practiceQuestions: [
      { type: 'mcq', prompt: 'q', options: ['א1', 'ב1', 'ג1', 'ד1'], answer: 'ב' }, // letter answer
      { type: 'mcq', prompt: 'q', options: ['1', '2'], answer: '3' }, // answer missing from options
      { type: 'weird', prompt: 'q', answer: '7' }, // unknown type → input
      { type: 'truefalse', prompt: 'q', answer: 'לא נכון' },
      { type: 'numberline', prompt: 'q', answer: '25', min: -5, max: 5 },
      { id: 'dup', prompt: 'a', answer: '1' }, { id: 'dup', prompt: 'b', answer: '2' },
      null,
    ],
    examQuestions: [{ type: 'order', prompt: 'x', items: ['a', 'b'] }],
  });
  assert.equal(c.learnSections[0].bullets.length, 0);
  assert.equal(c.learnSections[0].workedExample, null);
  const [a, b, w, tf, nl, d1, d2, n] = c.practiceQuestions;
  assert.equal(a.answer, 'ב1');
  assert.ok(b.options.includes('3'));
  assert.equal(w.type, 'input');
  assert.equal(tf.answer, 'false');
  assert.ok(nl.max >= 25);
  assert.notEqual(d1.id, d2.id);
  assert.equal(n.prompt, 'שאלה ללא ניסוח');
  assert.equal(c.exams.length, 1);
  assert.notEqual(c.exams[0].questions[0].type, 'order'); // exams only allow simple types
});

test('checkAnswer per type', () => {
  const [mcq, tf, inp] = normalizeTopicContent({
    practiceQuestions: [
      { type: 'mcq', prompt: 'p', options: ['$1$', '$2$'], answer: '$2$' },
      { type: 'truefalse', prompt: 'p', answer: true },
      { type: 'input', prompt: 'p', answer: '$12$', acceptedAnswers: ['twelve'] },
    ],
  }).practiceQuestions;
  assert.ok(checkAnswer(mcq, '$2$'));
  assert.ok(!checkAnswer(mcq, '$1$'));
  assert.ok(checkAnswer(tf, 'true'));
  assert.ok(checkAnswer(inp, '12'));
  assert.ok(checkAnswer(inp, 'Twelve'));
});

test('public questions hide answers and shuffle deterministically', () => {
  const [q] = normalizeTopicContent({ practiceQuestions: [{ type: 'order', prompt: 'p', items: ['1', '2', '3', '4'] }] }).practiceQuestions;
  const p1 = publicQuestion(q);
  const p2 = publicQuestion(q);
  assert.deepEqual(p1.items, p2.items);
  assert.notDeepEqual(p1.items, q.items);
  assert.equal(p1.answer, undefined);
});

test('pickBestModel prefers the newest stable flash model', async () => {
  const { pickBestModel } = await import('../server/ai.js');
  const m = (id) => ({ id, name: id });
  assert.equal(pickBestModel([m('gemini-2.5-pro'), m('gemini-3.8-flash'), m('gemini-3.5-flash-lite'), m('gemini-3.9-flash-preview-11-2026')]).id, 'gemini-3.8-flash');
  assert.equal(pickBestModel([m('gemini-2.5-flash'), m('gemini-3.1-pro-preview')]).id, 'gemini-3.1-pro-preview');
  assert.equal(pickBestModel([m('gemini-flash-latest')]).id, 'gemini-flash-latest');
  assert.equal(pickBestModel([]), null);
});

test('repairLatexEscapes restores LaTeX broken by JSON escapes', () => {
  const broken = JSON.parse('{"a":"$\\frac{1}{2}$ and $3 \\times 4$ and $a \\neq b$"}');
  const fixed = repairLatexEscapes(broken);
  assert.equal(fixed.a, '$\\frac{1}{2}$ and $3 \\times 4$ and $a \\neq b$');
});

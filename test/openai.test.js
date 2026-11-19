// Exercises the GPT engine against a fake OpenAI server: model discovery, fallback on
// overload, retry without unsupported parameters, PDF/image inputs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const calls = [];
let server;
let openai;

before(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
      if (req.headers.authorization !== 'Bearer sk-test') return send(401, { error: { message: 'Incorrect API key' } });
      if (req.url === '/v1/models') {
        return send(200, { data: ['gpt-5.2', 'gpt-4.1', 'gpt-5.2-pro', 'gpt-4o-realtime-preview', 'dall-e-3'].map((id) => ({ id })) });
      }
      if (req.url === '/v1/chat/completions') {
        const b = JSON.parse(body);
        calls.push(b);
        if (b.model === 'gpt-5.2') return send(503, { error: { message: 'The server is overloaded' } });
        if (b.reasoning_effort) return send(400, { error: { message: "Unrecognized request argument supplied: reasoning_effort" } });
        return send(200, { choices: [{ finish_reason: 'stop', message: { content: '{"title":"ok","practiceQuestions":[]}' } }] });
      }
      send(404, {});
    });
  });
  await new Promise((r) => server.listen(0, r));
  process.env.OPENAI_BASE_URL = `http://localhost:${server.address().port}/v1`;
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'adi-oa-'));
  openai = await import('../server/openai.js');
});

after(() => server.close());

test('lists only usable GPT models', async () => {
  const models = await openai.listOpenAIModels('sk-test');
  assert.deepEqual(models.map((m) => m.id).sort(), ['gpt-4.1', 'gpt-5.2', 'gpt-5.2-pro']);
  assert.equal(openai.pickBestOpenAIModel(models).id, 'gpt-5.2');
});

test('falls back from an overloaded model and drops unsupported params', async () => {
  calls.length = 0;
  const pdf = Buffer.from('%PDF-1.4 fake').toString('base64');
  const r = await openai.callOpenAI('Return JSON', [
    { kind: 'inline', mimeType: 'application/pdf', data: pdf, name: 'w.pdf' },
    { kind: 'inline', mimeType: 'image/png', data: 'iVBOR', name: 'p.png' },
    { kind: 'text', text: 'extra', name: 't' },
  ], { apiKey: 'sk-test' });
  assert.equal(r.model, 'gpt-4.1');
  assert.match(r.text, /"title":"ok"/);
  assert.equal(calls[0].model, 'gpt-5.2');
  const last = calls[calls.length - 1];
  assert.equal(last.reasoning_effort, undefined);
  assert.deepEqual(last.response_format, { type: 'json_object' });
  assert.equal(last.messages[0].content[1].type, 'file');
  assert.equal(last.messages[0].content[2].type, 'image_url');
});

test('connection test reports per-model results', async () => {
  const r = await openai.testOpenAI({ apiKey: 'sk-test' });
  assert.equal(r.busy, false);
  assert.equal(r.model, 'gpt-4.1');
  const bad = r.results.find((x) => x.model === 'gpt-5.2');
  assert.equal(bad.ok, false);
  assert.equal(bad.status, 503);
});

test('bad key gives a clear Hebrew error', async () => {
  await assert.rejects(() => openai.listOpenAIModels('sk-wrong'), /אינו תקין/);
});

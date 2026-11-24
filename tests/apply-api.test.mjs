import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { answerHandler, eventHandler, resultHandler, sessionHandler, submitHandler } from '../lib/apply/handlers.js';
import { hmac } from '../lib/apply/http.js';

const LONG = 'Достатъчно дълъг отговор за целта на теста.';
const mk = () => ({ LEADS_DIR: mkdtempSync(join(tmpdir(), 'apply-')), APPLY_SECRET: 'test-secret', N8N_WEBHOOK_URL: 'https://n8n.test/hook', N8N_WEBHOOK_SECRET: 'whsec' });
let n = 0;
const ip = () => `10.0.0.${++n}`;
const req = (method, path, body, cookie, extra = {}) => new Request('https://x.test' + path, { method, headers: { 'content-type': 'application/json', 'x-forwarded-for': extra.ip || '1.1.1.1', ...(cookie ? { cookie } : {}), ...(extra.headers || {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
const cookieOf = (res) => /tf_apply=[a-f0-9]{64}/.exec(res.headers.get('set-cookie') || '')?.[0];
const files = (env) => readdirSync(join(env.LEADS_DIR, 'apply'));

async function start(env, theIp = ip()) {
  const res = await sessionHandler(req('POST', '/api/apply/session', { locale: 'bg', deviceClass: 'mobile', utm: { utm_source: 'ig', evil: 'x' }, src: 'post-1' }, undefined, { ip: theIp }), env);
  return { cookie: cookieOf(res), body: await res.json(), ip: theIp };
}
const answer = (env, s, key, value, stepKey) => answerHandler(req('PATCH', '/api/apply/answer', { key, value, stepKey: stepKey || key }, s.cookie), env);

const FULL = { stage: 'idea', work: 'corporate', a1: LONG, a2: 'plan', a3: '6_20', a4: 'no_clients', ai1: 'never', g1: 'gt5', g2: 'team', g3: 'guide', g4: ['launch'], g5: LONG, g6: 'monthly' };
async function fillAll(env, s, a = FULL) { for (const [k, v] of Object.entries(a)) { const r = await answer(env, s, k, v); assert.equal(r.status, 200, `${k}: ${await r.clone().text()}`); } }
const contact = { name: 'Тест Тестов', email: 'test@example.com', phone: '+359 88 123 4567', channel: 'viber', consent_contact: true };
const fetchOk = (calls) => async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ success: true }) }; };

test('session: creates an httpOnly cookie, resumes with it, never stores the raw token', async () => {
  const env = mk(); const s = await start(env);
  assert.ok(s.cookie); assert.equal(s.body.resumed, false);
  const setc = (await sessionHandler(req('POST', '/api/apply/session', {}, undefined, { ip: ip() }), env)).headers.get('set-cookie');
  assert.match(setc, /HttpOnly/); assert.match(setc, /SameSite=Lax/);
  await answer(env, s, 'stage', 'running');
  const again = await sessionHandler(req('POST', '/api/apply/session', {}, s.cookie, { ip: ip() }), env);
  const j = await again.json();
  assert.equal(j.resumed, true); assert.equal(j.answers.stage, 'running');
  const raw = readFileSync(join(env.LEADS_DIR, 'apply', files(env).find((f) => f.endsWith('applications.json'))), 'utf8');
  assert.ok(!raw.includes(s.cookie.split('=')[1]), 'raw session token must not be stored');
  assert.ok(!raw.includes('evil'), 'unknown utm keys are dropped');
});

test('answers: need a session, reject invalid/unknown/inapplicable values, prune on stage change', async () => {
  const env = mk();
  assert.equal((await answerHandler(req('PATCH', '/api/apply/answer', { key: 'stage', value: 'idea' }), env)).status, 401);
  const s = await start(env);
  assert.equal((await answer(env, s, 'stage', 'hacker')).status, 422);
  assert.equal((await answer(env, s, 'nope', 'x')).status, 400);
  assert.equal((await answer(env, s, 'c2', 'lt3k')).status, 422); // not applicable yet
  await answer(env, s, 'stage', 'running'); await answer(env, s, 'c1', 'бизнес'); 
  const r = await (await answer(env, s, 'stage', 'launched')).json();
  assert.equal(r.answers.c1, undefined, 'old profile answers are pruned');
});

test('submit: blocked without consent, without email, when incomplete, without session, cross-origin, honeypot', async () => {
  const env = mk(); const s = await start(env); await fillAll(env, s);
  const sub = (body, cookie = s.cookie, extra = {}) => submitHandler(req('POST', '/api/apply/submit', body, cookie, { ip: ip(), ...extra }), env, fetchOk([]));
  assert.equal((await sub({ contact: { ...contact, consent_contact: false } })).status, 422);
  assert.equal((await sub({ contact: { ...contact, email: '' } })).status, 422);
  assert.equal((await sub({ contact }, '')).status, 401);
  assert.equal((await sub({ contact }, s.cookie, { headers: { origin: 'https://evil.test' } })).status, 403);
  assert.equal((await sub({ contact, website: 'bot' })).status, 400);
  const s2 = await start(env); await answer(env, s2, 'stage', 'idea');
  const inc = await submitHandler(req('POST', '/api/apply/submit', { contact }, s2.cookie, { ip: ip() }), env, fetchOk([]));
  assert.equal(inc.status, 422); assert.ok((await inc.json()).missing.includes('g6'));
});

test('submit: scores on the server, ignores client-supplied scores, notifies n8n with a valid HMAC, returns no internals', async () => {
  const env = mk(); const s = await start(env); await fillAll(env, s); const calls = [];
  const res = await submitHandler(req('POST', '/api/apply/submit', { contact, tier: 'RED', readiness: 1, score_points: 0, contact_name_override: 'x' }, s.cookie, { ip: ip() }), env, fetchOk(calls));
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.result.readiness, 93); assert.equal(j.result.cta, 'call');
  assert.doesNotMatch(JSON.stringify(j), /GREEN|YELLOW|RED|points|breakdown|"tier"/);
  assert.equal(j.email, 't***@example.com');
  const hook = calls.find((c) => c.url === env.N8N_WEBHOOK_URL);
  assert.ok(hook, 'n8n was called');
  assert.equal(hook.init.headers['X-Signature'], `sha256=${hmac('whsec', hook.init.body)}`);
  const payload = JSON.parse(hook.init.body);
  assert.equal(payload.tier, 'GREEN'); assert.equal(payload.readiness, 93); assert.equal(payload.priority, 'high'); assert.equal(payload.contact.email, 'test@example.com');
  const db = JSON.parse(readFileSync(join(env.LEADS_DIR, 'apply', files(env).find((f) => f.endsWith('applications.json'))), 'utf8'));
  const row = Object.values(db)[0];
  assert.equal(row.tier, 'GREEN'); assert.equal(row.score_points, 12); assert.ok(row.consent_contact_at); assert.equal(row.consent_marketing_at, null);
  // idempotent
  const again = await submitHandler(req('POST', '/api/apply/submit', { contact }, s.cookie, { ip: ip() }), env, fetchOk([]));
  assert.equal((await again.json()).result.readiness, 93);
});

test('events contain no personal data and no answers', async () => {
  const env = mk(); const s = await start(env); await fillAll(env, s);
  await submitHandler(req('POST', '/api/apply/submit', { contact }, s.cookie, { ip: ip() }), env, fetchOk([]));
  const ev = readFileSync(join(env.LEADS_DIR, 'apply', files(env).find((f) => f.endsWith('events.jsonl'))), 'utf8');
  for (const secret of ['test@example.com', 'Тест Тестов', '88 123', LONG, 'guide', 'monthly']) assert.ok(!ev.includes(secret), `events leaked: ${secret}`);
  assert.ok(ev.includes('"type":"submit"'));
});

test('event endpoint: whitelisted types only, anonymous visitors are ignored', async () => {
  const env = mk(); const s = await start(env);
  assert.equal((await eventHandler(req('POST', '/api/apply/event', { type: 'step_view', stepKey: 'g3' }, s.cookie), env)).status, 200);
  assert.equal((await eventHandler(req('POST', '/api/apply/event', { type: 'drop_table' }, s.cookie), env)).status, 400);
});

test('result link: opens with a valid signature, 404 when tampered', async () => {
  const env = mk(); const s = await start(env); await fillAll(env, s);
  const j = await (await submitHandler(req('POST', '/api/apply/submit', { contact }, s.cookie, { ip: ip() }), env, fetchOk([]))).json();
  const token = new URL(j.resultUrl, 'https://x.test').searchParams.get('t');
  const ok = await resultHandler(req('GET', '/x', undefined, undefined, { ip: ip() }), token, env);
  assert.equal(ok.status, 200); assert.equal((await ok.json()).result.readiness, 93);
  assert.equal((await resultHandler(req('GET', '/x', undefined, undefined, { ip: ip() }), token.slice(0, -2) + 'aa', env)).status, 404);
  assert.equal((await resultHandler(req('GET', '/x', undefined, undefined, { ip: ip() }), 'garbage', env)).status, 404);
});

test('production fails closed: no captcha secret rejects submit; missing APPLY_SECRET errors instead of using a default', async () => {
  const env = { ...mk(), SITE_ENV: 'production', VERCEL_ENV: 'production' };
  const s = await start(env); await fillAll(env, s);
  await assert.rejects(() => submitHandler(req('POST', '/api/apply/submit', { contact }, s.cookie, { ip: ip() }), { ...env, APPLY_SECRET: undefined }, fetchOk([])), /APPLY_SECRET/);
  const res = await submitHandler(req('POST', '/api/apply/submit', { contact }, s.cookie, { ip: ip() }), env, fetchOk([]));
  assert.equal(res.status, 400); assert.equal((await res.json()).error, 'captcha');
});

test('submit is rate limited per IP', async () => {
  const env = mk(); const same = ip(); let last;
  for (let i = 0; i < 7; i++) last = await submitHandler(req('POST', '/api/apply/submit', { contact }, undefined, { ip: same }), env, fetchOk([]));
  assert.equal(last.status, 429);
});

test('Supabase adapter talks to PostgREST with the service key and never sends it to the browser path', async () => {
  const { getStore } = await import('../lib/apply/store.js');
  const calls = []; const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => [{ id: '1' }] }; };
  try {
    const st = getStore({ SUPABASE_URL: 'https://p.supabase.co/', SUPABASE_SERVICE_ROLE_KEY: 'srv-key', SITE_ENV: 'staging' });
    assert.equal(st.kind, 'supabase');
    await st.get('abc'); await st.update('abc', { stage: 'idea' }); await st.event({ session_hash: 'abc', type: 'start' });
    assert.equal(calls[0].url, 'https://p.supabase.co/rest/v1/applications?session_hash=eq.abc&select=*');
    assert.equal(calls[0].init.headers.apikey, 'srv-key');
    assert.equal(calls[1].init.method, 'PATCH');
    assert.equal(JSON.parse(calls[2].init.body).environment, 'staging');
  } finally { globalThis.fetch = real; }
});

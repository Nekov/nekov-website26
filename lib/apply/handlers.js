// Request handlers for the apply questionnaire. Plain Request -> Response, so they run on Vercel and in tests.
// Rules: scoring happens only here; nothing from the browser can set a score; no personal data in events or logs.
import { QUESTIONS, prune, profileOf, steps } from './config.js';
import { missingRequired, validateAnswer, validateContact } from './validate.js';
import { evaluate, publicResult } from './scoring.js';
import { getStore, envName } from './store.js';
import { COOKIE, SESSION_DAYS, clientIp, hmac, json, limited, newToken, readCookie, sameOrigin, setCookie, sha256, signResult, verifyResult, verifyTurnstile } from './http.js';

const secretOf = (env) => {
  if (env.APPLY_SECRET) return env.APPLY_SECRET;
  if (envName(env) === 'production') throw new Error('APPLY_SECRET missing');
  return 'dev-only-secret';
};
const short = (v, n = 200) => (typeof v === 'string' ? v.slice(0, n) : null);
const cleanUtm = (u = {}) => Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].filter((k) => typeof u[k] === 'string').map((k) => [k, u[k].slice(0, 100)]));
const fresh = (row) => row && Date.now() - new Date(row.updated_at || row.started_at).getTime() < SESSION_DAYS * 864e5;

async function load(request, store) {
  const token = readCookie(request);
  if (!token) return { hash: null, row: null };
  const hash = sha256(token);
  const row = await store.get(hash);
  return { hash, row: fresh(row) ? row : null };
}
const view = (row) => ({ answers: row.answers || {}, stepKey: row.step_key || 'stage', steps: steps(row.answers || {}).map((s) => s.key), submitted: Boolean(row.submitted_at) });

/** POST /api/apply/session: create or continue a session (up to 7 days). */
export async function sessionHandler(request, env = process.env) {
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  if (!sameOrigin(request)) return json({ error: 'origin' }, 403);
  if (limited(`session:${clientIp(request)}`, 30)) return json({ error: 'rate_limited' }, 429);
  const store = getStore(env);
  const { row } = await load(request, store);
  const b = await request.json().catch(() => ({}));
  if (b.peek) return json(row && !row.submitted_at ? { resumed: true, ...view(row) } : { resumed: false }); // look, never create
  if (row && !row.submitted_at && !b.restart) return json({ resumed: true, ...view(row) });

  const token = newToken(); const hash = sha256(token);
  const created = await store.create({
    session_hash: hash, locale: b.locale === 'en' ? 'en' : 'bg', device_class: b.deviceClass === 'desktop' ? 'desktop' : 'mobile',
    utm: cleanUtm(b.utm), src: short(b.src, 100), referrer: short(b.referrer, 300), answers: {}, step_key: 'stage', profile: 'none',
  });
  await store.event({ session_hash: hash, type: 'start', step_key: 'stage', meta: {} });
  return json({ resumed: false, ...view(created) }, 200, { 'Set-Cookie': setCookie(token) });
}

/** PATCH /api/apply/answer: validate one answer against the config and save it. */
export async function answerHandler(request, env = process.env) {
  if (request.method !== 'PATCH') return json({ error: 'method' }, 405);
  if (!sameOrigin(request)) return json({ error: 'origin' }, 403);
  const store = getStore(env);
  const { hash, row } = await load(request, store);
  if (!row) return json({ error: 'no_session' }, 401);
  if (row.submitted_at) return json({ error: 'already_submitted' }, 409);
  if (limited(`answer:${hash}`, 200)) return json({ error: 'rate_limited' }, 429);

  const b = await request.json().catch(() => null);
  if (!b || typeof b.key !== 'string' || !QUESTIONS[b.key]) return json({ error: 'unknown_question' }, 400);
  const v = validateAnswer(b.key, b.value, row.answers || {});
  if (!v.ok) return json({ error: v.error }, 422);

  const answers = prune({ ...(row.answers || {}), [b.key]: v.value });
  const next = await store.update(hash, {
    answers, stage: answers.stage || null, work: answers.work || null, profile: profileOf(answers.stage),
    step_key: short(b.stepKey, 40) || row.step_key,
  });
  await store.event({ session_hash: hash, type: 'step_complete', step_key: short(b.stepKey, 40) || b.key, meta: {} }); // never the answer itself
  return json(view(next));
}

const EVENT_TYPES = ['view', 'step_view', 'step_back', 'card_view', 'abandon', 'result_view', 'cta_click'];
/** POST /api/apply/event: funnel events from the browser. Whitelisted types and keys, no free-form data. */
export async function eventHandler(request, env = process.env) {
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  if (!sameOrigin(request)) return json({ error: 'origin' }, 403);
  const store = getStore(env);
  const { hash } = await load(request, store);
  if (!hash) return json({ ok: true }); // anonymous page views are not tracked without a session
  if (limited(`event:${hash}`, 400)) return json({ error: 'rate_limited' }, 429);
  const b = await request.json().catch(() => ({}));
  if (!EVENT_TYPES.includes(b.type)) return json({ error: 'type' }, 400);
  const keys = new Set(['welcome', 'result', 'thanks', ...steps({ stage: 'idea', g6: 'unknown' }).map((s) => s.key), ...steps({ stage: 'launched', g6: 'unknown' }).map((s) => s.key), 'n1', 'n2', 'n3', 'c1', 'c2', 'c3', 'c4', 'c5']);
  await store.event({ session_hash: hash, type: b.type, step_key: keys.has(b.stepKey) ? b.stepKey : null, meta: {} });
  return json({ ok: true });
}

async function notify(payload, env, fetchImpl) {
  if (!env.N8N_WEBHOOK_URL) return false;
  const body = JSON.stringify(payload);
  const sig = env.N8N_WEBHOOK_SECRET ? `sha256=${hmac(env.N8N_WEBHOOK_SECRET, body)}` : '';
  try {
    const res = await fetchImpl(env.N8N_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Signature': sig }, body });
    return res.ok;
  } catch { return false; }
}

const mask = (e) => e.replace(/^(.).*(@.*)$/, '$1***$2');

/** POST /api/apply/submit: validate contacts, score on the server, store, notify, return the result. */
export async function submitHandler(request, env = process.env, fetchImpl = fetch) {
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  if (!sameOrigin(request)) return json({ error: 'origin' }, 403);
  const ip = clientIp(request);
  if (limited(`submit:${ip}`, 5)) return json({ error: 'rate_limited' }, 429);
  const store = getStore(env);
  const { hash, row } = await load(request, store);
  if (!row) return json({ error: 'no_session' }, 401);
  const secret = secretOf(env);
  const resultUrl = (id) => `${env.APPLY_BASE_URL || ''}/apply/result/?t=${signResult(id, secret)}`;
  if (row.submitted_at) return json({ result: publicResult(row.answers), resultUrl: resultUrl(row.id), email: mask(row.contact_email || '') }); // idempotent

  const b = await request.json().catch(() => null);
  if (!b) return json({ error: 'body' }, 400);
  if (b.website) return json({ error: 'rejected' }, 400); // honeypot
  if (!(await verifyTurnstile(b.turnstileToken, ip, env, fetchImpl))) return json({ error: 'captcha' }, 400);

  const answers = row.answers || {};
  if (answers.stage === 'browsing') return json({ error: 'not_submittable' }, 400);
  const missing = missingRequired(answers);
  if (missing.length) return json({ error: 'incomplete', missing }, 422);
  const c = validateContact(b.contact);
  if (!c.ok) return json({ error: 'contact', fields: c.errors }, 422);

  // Scoring happens here and only here. Nothing sent by the browser can change it.
  const ev = evaluate(answers);
  const now = new Date().toISOString();
  const saved = await store.update(hash, {
    contact_name: c.value.name, contact_email: c.value.email, contact_phone: c.value.phone, contact_channel: c.value.channel, contact_link: c.value.link,
    consent_contact_at: now, consent_marketing_at: c.value.consent_marketing ? now : null,
    submitted_at: now, step_key: 'result', ...ev,
  });
  const result = publicResult(answers);
  const url = resultUrl(saved.id);
  const notified = await notify({
    application_id: saved.id, record_link: `${env.APPLY_ADMIN_URL || ''}/admin/insights?id=${saved.id}`,
    priority: ev.tier === 'GREEN' || ev.flags.length ? 'high' : 'normal', tier: ev.tier, readiness: ev.readiness, flags: ev.flags,
    profile: saved.profile, locale: saved.locale, environment: envName(env),
    obstacle: result.obstacle, tasks: result.tasks, ai1: answers.ai1 || null, ai2: answers.ai2 || [], budget: answers.g6 || null, attitude: answers.g3 || null,
    contact: { name: c.value.name, email: c.value.email, phone: c.value.phone, channel: c.value.channel, link: c.value.link },
    consent_marketing: c.value.consent_marketing, cta: result.cta, result_url: url,
  }, env, fetchImpl);
  await store.event({ session_hash: hash, type: 'submit', step_key: 'contact', meta: { notified } });
  return json({ result, resultUrl: url, email: mask(c.value.email), notified });
}

/** GET /api/apply/result/[token]: re-open a result from the signed link in the email. */
export async function resultHandler(request, token, env = process.env) {
  if (request.method !== 'GET') return json({ error: 'method' }, 405);
  if (limited(`result:${clientIp(request)}`, 60)) return json({ error: 'rate_limited' }, 429);
  const id = verifyResult(token, secretOf(env));
  if (!id) return json({ error: 'invalid_link' }, 404);
  const row = await getStore(env).getById(id);
  if (!row || !row.submitted_at) return json({ error: 'invalid_link' }, 404);
  return json({ result: publicResult(row.answers), email: mask(row.contact_email || ''), locale: row.locale });
}

// POST /api/contact: validate, honeypot, rate limit, deliver, then redirect.
// Delivery: email to Nikolay via FormSubmit (alias in FORMSUBMIT_ALIAS) and a local JSONL copy.
// Either one succeeding counts. Never logs submitted data. Staging and production use separate files.
import { appendFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isProduction } from './env.js';

const TOPICS = ['Проект', 'Партньорство', 'Стратегическа сесия', 'Обучение', 'Друго'];
const LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };
const hits = new Map(); // best-effort, per instance

const redirect = (to) => new Response(null, { status: 303, headers: { Location: to, 'Cache-Control': 'no-store' } });
const fail = (status, msg) =>
  new Response(`<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Грешка</title><p>${msg}</p><p><a href="javascript:history.back()">← Назад</a></p>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < LIMIT.windowMs);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > LIMIT.max;
}

/** Local storage target. Vercel's filesystem is read-only apart from /tmp, which is not persistent. */
export function leadsFile(env = process.env) {
  const dir = env.LEADS_DIR || (env.VERCEL ? join(tmpdir(), 'leads') : 'data');
  return join(dir, `${isProduction(env) ? 'production' : 'staging'}-leads.jsonl`);
}

/** Email through FormSubmit's JSON endpoint. The alias is a secret-ish address stand-in: env only. */
async function deliver(lead, env, fetchImpl) {
  if (!env.FORMSUBMIT_ALIAS) return false;
  const staging = lead.environment !== 'production';
  const res = await fetchImpl(`https://formsubmit.co/ajax/${encodeURIComponent(env.FORMSUBMIT_ALIAS)}`, {
    method: 'POST',
    // FormSubmit rejects requests without a browser-style Origin/Referer.
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: 'https://www.nekov.com', Referer: 'https://www.nekov.com/' },
    body: JSON.stringify({
      _subject: `${staging ? '[STAGING] ' : ''}Нова заявка от nekov.com: ${lead.topic}`,
      _captcha: 'false',
      _template: 'table',
      name: lead.name,
      email: lead.email,
      topic: lead.topic,
      message: lead.message,
      ...lead.intake,
      language: lead.language,
      source: lead.source,
      environment: lead.environment,
    }),
  });
  // FormSubmit answers HTTP 200 even when it refuses (e.g. not activated), so read the body.
  const body = await res.json().catch(() => ({}));
  return res.ok && String(body.success) === 'true';
}

export async function handleContact(request, env = process.env, fetchImpl = fetch) {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });

  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host && new URL(origin).host !== request.headers.get('host')) {
    return fail(403, 'Невалидна заявка.');
  }

  const ip = (request.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
  if (limited(ip)) return fail(429, 'Твърде много опити. Опитай отново след малко.');

  const f = await request.formData();
  const get = (k, max) => String(f.get(k) ?? '').trim().slice(0, max);

  if (get('website', 100)) return redirect('/sent/'); // honeypot: pretend success

  const lead = {
    name: get('name', 200),
    email: get('email', 200),
    topic: get('topic', 50),
    message: get('message', 5000),
    language: get('language', 5) === 'en' ? 'en' : 'bg',
    source: get('source', 200),
    intake: ['intake_business', 'intake_goal', 'intake_stage'].reduce((o, k) => (f.get(k) ? { ...o, [k]: get(k, 2000) } : o), {}),
    environment: isProduction(env) ? 'production' : 'staging',
    created_at: new Date().toISOString(),
  };
  if (!lead.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) return fail(400, 'Моля, въведи име и валиден имейл.');
  if (!TOPICS.includes(lead.topic)) return fail(400, 'Моля, избери тема.');
  if (f.get('consent') !== 'on') return fail(400, 'Нужно е съгласие с политиката за поверителност.');

  const emailed = await deliver(lead, env, fetchImpl).catch(() => false);
  const stored = await (async () => {
    const file = leadsFile(env);
    await mkdir(join(file, '..'), { recursive: true });
    await appendFile(file, JSON.stringify(lead) + '\n');
    return true;
  })().catch(() => false);
  if (!emailed && !stored) return fail(502, 'Не успях да изпратя запитването. Моля, пиши ми на hello@nekov.com.');

  // Strategy session: after the intake is stored, continue to the Payment Link (test-mode on staging).
  if (f.get('intent') === 'session' && env.STRIPE_SESSION_LINK) return redirect(env.STRIPE_SESSION_LINK);
  return redirect('/sent/');
}

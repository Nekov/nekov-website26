import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const COOKIE = 'tf_apply';
export const SESSION_DAYS = 7;

export const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
export const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export const newToken = () => randomBytes(32).toString('hex');

export function readCookie(request, name = COOKIE) {
  const m = new RegExp(`(?:^|;\\s*)${name}=([a-f0-9]{64})(?:;|$)`).exec(request.headers.get('cookie') || '');
  return m ? m[1] : null;
}
export const setCookie = (token) => `${COOKIE}=${token}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`;

/** Same-origin check for state-changing requests. */
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true; // non-browser clients; cookies are SameSite=Lax anyway
  try { const o = new URL(origin).host; return o === new URL(request.url).host || o === request.headers.get('host'); } catch { return false; }
}

/** Best-effort per-instance rate limit. */
const hits = new Map();
export function limited(key, max, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  recent.push(now); hits.set(key, recent);
  return recent.length > max;
}
export const clientIp = (request) => (request.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();

export const hmac = (secret, data) => createHmac('sha256', secret).update(data).digest('hex');
export function safeEqual(a, b) { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); }

/** Signed, tamper-proof link for viewing a result again. */
export const signResult = (id, secret) => `${id}.${hmac(secret, `result:${id}`).slice(0, 32)}`;
export function verifyResult(token, secret) {
  const [id, sig] = String(token).split('.');
  return id && sig && safeEqual(sig, hmac(secret, `result:${id}`).slice(0, 32)) ? id : null;
}

/** Cloudflare Turnstile. Skipped only when no secret is configured (development). */
export async function verifyTurnstile(token, ip, env, fetchImpl = fetch) {
  if (!env.TURNSTILE_SECRET) return env.SITE_ENV !== 'production'; // production without a secret fails closed
  if (!token) return false;
  try {
    const res = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }) });
    return (await res.json()).success === true;
  } catch { return false; }
}

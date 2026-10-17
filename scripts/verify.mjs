// Gate A checks. Builds staging and production variants and asserts the guarantees from the brief.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let failed = 0;
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failed++; };
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const build = (env, out) => execFileSync('node', ['scripts/build.mjs'], { env: { ...process.env, ...env, OUT_DIR: out }, stdio: 'pipe' });
const EXTERNAL_TRACKING = /googletagmanager|connect\.facebook\.net|facebook\.com\/tr|\bfbq\('init'|\bgtag\('config'/;

// ── Staging (default, fail-safe) ──
build({ SITE_ENV: '', VERCEL_ENV: '' }, 'dist-verify-stg');
const stg = walk('dist-verify-stg').filter((p) => p.endsWith('.html'));
check('staging: robots.txt is Disallow: /', /Disallow:\s*\/\s*$/m.test(readFileSync('dist-verify-stg/robots.txt', 'utf8')));
check('staging: no sitemap.xml', !existsSync('dist-verify-stg/sitemap.xml'));
check('staging: every page has robots noindex meta', stg.every((p) => /name="robots"\s+content="noindex/i.test(readFileSync(p, 'utf8'))));
check('staging: no Pixel/GA4 loaders or init in any page', stg.every((p) => !EXTERNAL_TRACKING.test(readFileSync(p, 'utf8'))));
check('staging: no canonical/hreflang pointing at production', stg.every((p) => !/rel="(canonical|alternate)"/i.test(readFileSync(p, 'utf8'))));

// A preview that wrongly has SITE_ENV=production must still be staging.
build({ SITE_ENV: 'production', VERCEL_ENV: 'preview' }, 'dist-verify-stg2');
check('preview with SITE_ENV=production is still staging', /Disallow:\s*\//.test(readFileSync('dist-verify-stg2/robots.txt', 'utf8')));

// ── Production ──
build({ SITE_ENV: 'production', VERCEL_ENV: 'production' }, 'dist-verify-prod');
const home = readFileSync('dist-verify-prod/index.html', 'utf8');
check('production: robots.txt allows', /Allow:\s*\//.test(readFileSync('dist-verify-prod/robots.txt', 'utf8')));
check('production: sitemap.xml present', existsSync('dist-verify-prod/sitemap.xml'));
check('production: home has no noindex, has canonical + hreflang', !/noindex/.test(home) && /rel="canonical"/.test(home) && /hreflang="x-default"/.test(home));
check('production: /sent/ stays noindex, /services/ is indexable', /noindex/.test(readFileSync('dist-verify-prod/sent/index.html', 'utf8')) && !/noindex/.test(readFileSync('dist-verify-prod/services/index.html', 'utf8')));
check('production: /workshop byte-identical to source', execFileSync('diff', ['-r', 'workshop', 'dist-verify-prod/workshop']).length === 0);

// ── Contact endpoint ──
const { handleContact } = await import('../lib/contact.js');
process.env.LEADS_DIR = 'dist-verify-leads';
const post = (fields, headers = {}) => handleContact(new Request('https://x.test/api/contact', { method: 'POST', headers: { 'x-forwarded-for': String(Math.random()), ...headers }, body: new URLSearchParams(fields) }));
const ok = { name: 'A', email: 'a@b.co', topic: 'Проект', consent: 'on' };
check('contact: valid post stores and redirects to /sent/', (await post(ok)).headers.get('location') === '/sent/' && existsSync('dist-verify-leads/staging-leads.jsonl'));
check('contact: missing consent is rejected', (await post({ ...ok, consent: '' })).status === 400);
check('contact: honeypot redirects without storing', (await post({ ...ok, website: 'x', name: 'Bot' })).status === 303 && !readFileSync('dist-verify-leads/staging-leads.jsonl', 'utf8').includes('Bot'));
check('contact: cross-origin post rejected', (await post(ok, { origin: 'https://evil.test' })).status === 403);
const sent = [];
const fakeFetch = async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return { ok: true }; };
const mock = (fields, env, f = fakeFetch) => handleContact(new Request('https://x.test/api/contact', { method: 'POST', headers: { 'x-forwarded-for': String(Math.random()) }, body: new URLSearchParams(fields) }), env, f);
await mock(ok, { FORMSUBMIT_ALIAS: 'abc123', LEADS_DIR: 'dist-verify-leads' });
check('contact: emails via FormSubmit alias, [STAGING] subject on staging', sent[0]?.url === 'https://formsubmit.co/ajax/abc123' && sent[0].body._subject.startsWith('[STAGING] ') && sent[0].body.email === 'a@b.co');
sent.length = 0;
await mock(ok, { FORMSUBMIT_ALIAS: 'abc123', SITE_ENV: 'production', VERCEL_ENV: 'production', LEADS_DIR: 'dist-verify-leads' });
check('contact: no [STAGING] prefix in production', sent[0] && !sent[0].body._subject.startsWith('[STAGING]'));
check('contact: email failure falls back to local copy', (await mock(ok, { FORMSUBMIT_ALIAS: 'abc123', LEADS_DIR: 'dist-verify-leads' }, async () => { throw new Error('down'); })).headers.get('location') === '/sent/');
check('contact: error when both email and storage fail', (await mock(ok, { FORMSUBMIT_ALIAS: 'abc123', LEADS_DIR: '/dev/null/x' }, async () => ({ ok: false }))).status === 502);
const same = { 'x-forwarded-for': '9.9.9.9' };
let last; for (let i = 0; i < 7; i++) last = await post(ok, same);
check('contact: rate limit returns 429', last.status === 429);
execFileSync('rm', ['-rf', 'dist-verify-leads']);

// ── Middleware ──
const { default: mw } = await import('../middleware.js');
const req = (headers = {}) => new Request('https://x.test/', { headers });
const setEnv = (e) => { for (const k of ['SITE_ENV', 'VERCEL_ENV', 'STAGING_USER', 'STAGING_PASS']) delete process.env[k]; Object.assign(process.env, e); };

setEnv({});
let r = mw(req());
check('middleware (staging): X-Robots-Tag noindex, nofollow + continues', r.headers.get('X-Robots-Tag') === 'noindex, nofollow' && r.headers.get('x-middleware-next') === '1');
setEnv({ SITE_ENV: 'production', VERCEL_ENV: 'production' });
check('middleware (production): does nothing', mw(req()) === undefined);
setEnv({ SITE_ENV: 'production', VERCEL_ENV: 'preview' });
check('middleware (preview mislabelled production): still noindex', mw(req()).headers.get('X-Robots-Tag') === 'noindex, nofollow');
setEnv({ STAGING_USER: 'u', STAGING_PASS: 'p:w' });
check('middleware basic auth: 401 without credentials', mw(req()).status === 401);
check('middleware basic auth: 401 with wrong credentials', mw(req({ authorization: 'Basic ' + btoa('u:nope') })).status === 401);
check('middleware basic auth: passes with correct credentials (password may contain ":")', mw(req({ authorization: 'Basic ' + btoa('u:p:w') })).headers.get('x-middleware-next') === '1');
check('middleware basic auth: 401 response is also noindex', mw(req()).headers.get('X-Robots-Tag') === 'noindex, nofollow');

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);

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

// ── Form targets (FormSubmit blocks cloud servers, so browsers post to it directly) ──
const withAlias = (env, out) => { execFileSync('node', ['scripts/build.mjs'], { env: { ...process.env, FORMSUBMIT_ALIAS: 'abc123', STRIPE_SESSION_LINK: 'https://buy.stripe.com/test_x', ...env, OUT_DIR: out }, stdio: 'pipe' }); return [readFileSync(`${out}/index.html`, 'utf8'), readFileSync(`${out}/services/index.html`, 'utf8')]; };
const [stgHome, stgSvc] = withAlias({ SITE_ENV: '', VERCEL_BRANCH_URL: 'stg.example.test' }, 'dist-verify-f1');
check('forms (staging): post to FormSubmit, [STAGING] subject, returns to staging /sent/', stgHome.includes('action="https://formsubmit.co/abc123"') && stgHome.includes('[STAGING] ') && stgHome.includes('value="https://stg.example.test/sent/"'));
check('forms (staging): session intake continues to the Stripe link', stgSvc.includes('name="_next" value="https://buy.stripe.com/test_x"'));
const [prodHome] = withAlias({ SITE_ENV: 'production', VERCEL_ENV: 'production' }, 'dist-verify-f2');
check('forms (production): no [STAGING] prefix, returns to nekov.com/sent/', !prodHome.includes('[STAGING]') && prodHome.includes('value="https://www.nekov.com/sent/"'));
check('forms: no alias falls back to /api/contact/', readFileSync('dist-verify-stg/index.html', 'utf8').includes('action="/api/contact/"'));

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
const fakeFetch = async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return { ok: true, json: async () => ({ success: 'true' }) }; };
const mock = (fields, env, f = fakeFetch) => handleContact(new Request('https://x.test/api/contact', { method: 'POST', headers: { 'x-forwarded-for': String(Math.random()) }, body: new URLSearchParams(fields) }), env, f);
await mock(ok, { FORMSUBMIT_ALIAS: 'abc123', LEADS_DIR: 'dist-verify-leads' });
check('contact: emails via FormSubmit alias, [STAGING] subject on staging', sent[0]?.url === 'https://formsubmit.co/ajax/abc123' && sent[0].body._subject.startsWith('[STAGING] ') && sent[0].body.email === 'a@b.co');
sent.length = 0;
await mock(ok, { FORMSUBMIT_ALIAS: 'abc123', SITE_ENV: 'production', VERCEL_ENV: 'production', LEADS_DIR: 'dist-verify-leads' });
check('contact: no [STAGING] prefix in production', sent[0] && !sent[0].body._subject.startsWith('[STAGING]'));
check('contact: email failure with alias set is an error, not a fake success', (await mock(ok, { FORMSUBMIT_ALIAS: 'abc123', LEADS_DIR: 'dist-verify-leads' }, async () => { throw new Error('down'); })).status === 502);
check('contact: error when both email and storage fail', (await mock(ok, { FORMSUBMIT_ALIAS: 'abc123', LEADS_DIR: '/dev/null/x' }, async () => ({ ok: false, json: async () => ({}) }))).status === 502);
check('contact: HTTP 200 with success:"false" (not activated) is NOT treated as delivered', (await mock(ok, { FORMSUBMIT_ALIAS: 'abc123', LEADS_DIR: '/dev/null/x' }, async () => ({ ok: true, json: async () => ({ success: 'false' }) }))).status === 502);
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

// ── Language selection ──
setEnv({});
const lreq = (path, headers = {}, method = 'GET') => new Request('https://x.test' + path, { method, headers });
const loc = (r) => r?.headers?.get('location');
check('lang: Accept-Language en on "/" -> 302 /en/', (() => { const r = mw(lreq('/', { 'accept-language': 'en-US,en;q=0.9' })); return r.status === 302 && loc(r) === 'https://x.test/en/'; })());
check('lang: Accept-Language de -> /en/ (every non-Bulgarian language)', loc(mw(lreq('/', { 'accept-language': 'de-DE' }))) === 'https://x.test/en/');
check('lang: Accept-Language bg stays on "/"', mw(lreq('/', { 'accept-language': 'bg-BG,bg;q=0.9,en;q=0.8' })).status !== 302);
check('lang: highest q wins (en;q=0.9 beats bg;q=0.5)', loc(mw(lreq('/', { 'accept-language': 'bg;q=0.5,en;q=0.9' }))) === 'https://x.test/en/');
check('lang: no Accept-Language stays on "/"', mw(lreq('/')).status !== 302);
check('lang: saved cookie bg beats Accept-Language en', mw(lreq('/', { 'accept-language': 'en', cookie: 'a=1; lang=bg' })).status !== 302);
check('lang: saved cookie en redirects even for Bulgarian browsers', loc(mw(lreq('/', { 'accept-language': 'bg', cookie: 'lang=en' }))) === 'https://x.test/en/');
check('lang: deep links are never redirected', mw(lreq('/services/', { 'accept-language': 'en' })).status !== 302);
check('lang: crawlers are never redirected', mw(lreq('/', { 'accept-language': 'en', 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' })).status !== 302);
check('lang: POST to "/" is not redirected', mw(lreq('/', { 'accept-language': 'en' }, 'POST')).status !== 302);
setEnv({ SITE_ENV: 'production', VERCEL_ENV: 'production' });
check('lang (production): redirect works, no X-Robots-Tag added', (() => { const r = mw(lreq('/', { 'accept-language': 'en' })); return r.status === 302 && !r.headers.get('X-Robots-Tag'); })());
check('lang (production): other requests untouched', mw(lreq('/services/', { 'accept-language': 'en' })) === undefined);

// ── Bilingual structure ──
const pairs = ['', 'services/', 'trainings/', 'privacy/', 'sent/'];
check('both languages exist for every page', pairs.every((p) => existsSync(`dist-verify-stg/${p}index.html`) && existsSync(`dist-verify-stg/en/${p}index.html`)));
check('bg pages: lang=bg and no Latin-only copy leaks in (h1 has Cyrillic)', pairs.every((p) => { const h = readFileSync(`dist-verify-stg/${p}index.html`, 'utf8'); return /<html lang="bg">/.test(h) && /<h1[^>]*>[^<]*[А-я]/.test(h); }));
check('en pages: lang=en and no Cyrillic in visible copy', pairs.every((p) => { const h = readFileSync(`dist-verify-stg/en/${p}index.html`, 'utf8'); const vis = h.replace(/<(script|style)[\s\S]*?<\/\1>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/БГ/g, ''); return /<html lang="en">/.test(h) && !/[А-я]/.test(vis); }));
check('language switch links to the equivalent page (not #)', (() => { const h = readFileSync('dist-verify-stg/services/index.html', 'utf8'); return h.includes('href="/en/services/" data-lang="en"') && !/data-lang="en"[^>]*href="#"/.test(h); })());
const prodHtml = readFileSync('dist-verify-prod/index.html', 'utf8');
check('production: hreflang bg/en/x-default, JSON-LD Person + ProfessionalService, og:image', ['hreflang="bg"', 'hreflang="en"', 'hreflang="x-default"', '"@type":"Person"', '"@type":"ProfessionalService"', 'og:image'].every((x) => prodHtml.includes(x)));
check('production: sitemap lists both languages with hreflang, no /sent/', (() => { const m = readFileSync('dist-verify-prod/sitemap.xml', 'utf8'); return m.includes('/en/services/') && m.includes('hreflang="x-default"') && !m.includes('/sent/'); })());
check('staging: no JSON-LD / og:url pointing at production, no consent code', (() => { const h = readFileSync('dist-verify-stg/index.html', 'utf8'); return !h.includes('application/ld+json') && !h.includes('og:url') && !h.includes('consent-banner') && !h.includes('trk-config') && !existsSync('dist-verify-stg/js/consent.js'); })());
check('og image is 1200x630', (await (await import('sharp')).default('dist-verify-prod/img/og.jpg').metadata()).width === 1200);
check('tracking: production without ENABLE_TRACKING ships no banner or loader', !prodHtml.includes('consent-banner') && !existsSync('dist-verify-prod/js/consent.js'));
build({ SITE_ENV: 'production', VERCEL_ENV: 'production', ENABLE_TRACKING: 'true', GA4_ID: 'G-TEST', FB_PIXEL_ID: '123' }, 'dist-verify-trk');
const trk = readFileSync('dist-verify-trk/index.html', 'utf8');
check('tracking: with ENABLE_TRACKING a banner + config + consent.js are present, and no third-party script loads before consent', trk.includes('id="consent-banner"') && trk.includes('G-TEST') && !/googletagmanager|connect\.facebook\.net/.test(trk) && existsSync('dist-verify-trk/js/consent.js'));
build({ SITE_ENV: '', ENABLE_TRACKING: 'true', GA4_ID: 'G-TEST' }, 'dist-verify-trk2');
check('tracking: ENABLE_TRACKING=true is ignored outside production', !readFileSync('dist-verify-trk2/index.html', 'utf8').includes('consent-banner'));

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);

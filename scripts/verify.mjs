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
check('production: /workshop byte-identical to source', execFileSync('diff', ['-r', 'workshop', 'dist-verify-prod/workshop']).length === 0);

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

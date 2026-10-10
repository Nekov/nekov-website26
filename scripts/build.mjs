// Static build: new pages from src/, untouched legacy pages copied through.
// On anything that is not production, tracking is stripped and the site is made unindexable.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isProduction } from '../lib/env.js';
import { layout } from '../src/layout.mjs';
import { bg } from '../src/content/bg.mjs';
import { home } from '../src/pages/home.mjs';
import { services } from '../src/pages/services.mjs';
import { trainings } from '../src/pages/trainings.mjs';
import { privacy, sent } from '../src/pages/simple.mjs';
import { buildImages, pic } from './images.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, process.env.OUT_DIR || 'dist');
const prod = isProduction();
const SITE = 'https://www.nekov.com';

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const write = (rel, data) => {
  mkdirSync(dirname(join(out, rel)), { recursive: true });
  writeFileSync(join(out, rel), data);
};

// ── New pages ────────────────────────────────────────────────────────
const images = await buildImages(root, out);
const img = (name, opts) => pic(images, name, opts);
write('index.html', layout({
  c: bg,
  prod,
  site: SITE,
  page: { canonical: '/', alternates: [['bg', '/'], ['en', '/en/'], ['x-default', '/']] },
  body: home(bg, img),
}));
const page = (rel, { meta, canonical, switchTo, body, noindex }) => write(rel, layout({
  c: bg, prod, site: SITE,
  page: { meta, canonical, noindex, switch: { bg: canonical || '/', en: switchTo || '/en/' }, alternates: null },
  body,
}));
page('services/index.html', { meta: bg.services.meta, canonical: '/services/', body: services(bg, { stripeConfigured: Boolean(process.env.STRIPE_SESSION_LINK) }) });
page('trainings/index.html', { meta: bg.trainings.meta, canonical: '/trainings/', body: trainings(bg, img) });
page('privacy/index.html', { meta: bg.privacy.meta, canonical: '/privacy/', body: privacy(bg) });
page('sent/index.html', { meta: bg.sent.meta, canonical: '/sent/', noindex: true, body: sent(bg) });
cpSync(join(root, 'src/fonts'), join(out, 'fonts'), { recursive: true });
mkdirSync(join(out, 'css'), { recursive: true });
mkdirSync(join(out, 'js'), { recursive: true });
cpSync(join(root, 'src/styles/site.css'), join(out, 'css/site.css'));
cpSync(join(root, 'src/site.js'), join(out, 'js/site.js'));

// ── Pass-through: assets and routes not yet rebuilt ──────────────────
// Legacy pages stay byte-identical in production. /workshop is never edited.
for (const d of ['images', 'css/styles.css', 'js/main.js', 'workshop', 'thankyou', 'en/workshop']) {
  cpSync(join(root, d), join(out, d), { recursive: true });
}
cpSync(join(root, 'legacy/en/index.html'), join(out, 'en/index.html'));

// ── Non-production hardening ─────────────────────────────────────────
// Loaders, or calls that would throw without the library. Guarded helpers (typeof fbq / typeof gtag)
// are inert when nothing is loaded, so they stay: /workshop buttons call trackCheckout().
const LOADER = /googletagmanager|connect\.facebook\.net|facebook\.com\/tr/;
const UNGUARDED = /\b(?:fbq|gtag)\s*\(/;
const isTracking = (m) => LOADER.test(m) || (UNGUARDED.test(m) && !/typeof\s+(?:fbq|gtag)/.test(m));

export function stagingify(html) {
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (m) => (isTracking(m) ? '' : m));
  html = html.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, (m) => (isTracking(m) ? '' : m));
  html = html.replace(/<!--[\s\S]*?-->/g, (m) => (/pixel|gtag|google tag|facebook/i.test(m) ? '' : m));
  // No pointers to production.
  html = html.replace(/<link\s+rel="(?:canonical|alternate)"[^>]*>\s*/gi, '');
  html = html.replace(/<meta\s+property="og:url"[^>]*>\s*/gi, '');
  if (!/name="robots"/i.test(html)) {
    html = html.replace(/<head>/i, '<head>\n  <meta name="robots" content="noindex,nofollow">');
  }
  return html;
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

if (!prod) {
  for (const f of walk(out).filter((p) => p.endsWith('.html'))) {
    const src = readFileSync(f, 'utf8');
    writeFileSync(f, stagingify(src));
  }
  writeFileSync(join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
} else {
  cpSync(join(root, 'robots.txt'), join(out, 'robots.txt'));
  cpSync(join(root, 'sitemap.xml'), join(out, 'sitemap.xml'));
}

console.log(`built ${prod ? 'PRODUCTION' : 'STAGING'} → ${out}`);

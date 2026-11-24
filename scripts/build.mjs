// Static build: new pages from src/, untouched legacy pages copied through.
// On anything that is not production, tracking is stripped and the site is made unindexable.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { llmsTxt } from './llms.mjs';
import { isProduction, trackingEnabled } from '../lib/env.js';
import { layout } from '../src/layout.mjs';
import { bg } from '../src/content/bg.mjs';
import { en } from '../src/content/en.mjs';
import { home } from '../src/pages/home.mjs';
import { services } from '../src/pages/services.mjs';
import { trainings } from '../src/pages/trainings.mjs';
import { privacy, sent } from '../src/pages/simple.mjs';
import { apply } from '../src/pages/apply.mjs';
import { applyBg } from '../src/apply/content.bg.mjs';
import { applyEn } from '../src/apply/content.en.mjs';
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

// ── New pages, both languages from one set of page functions ─────────
const images = await buildImages(root, out);
const img = (name, opts) => pic(images, name, opts);
const stripeConfigured = Boolean(process.env.STRIPE_SESSION_LINK);
const tracking = trackingEnabled();
const sitemap = [];

// bg path -> { build(c), meta(c), noindex }
const PAGES = [
  { path: '/', meta: (c) => c.meta, body: (c) => home(c, img), jsonld: 'home' },
  { path: '/services/', meta: (c) => c.services.meta, body: (c) => services(c, { stripeConfigured }), jsonld: 'services' },
  { path: '/trainings/', meta: (c) => c.trainings.meta, body: (c) => trainings(c, img) },
  { path: '/privacy/', meta: (c) => c.privacy.meta, body: (c) => privacy(c) },
  { path: '/sent/', meta: (c) => c.sent.meta, body: (c) => sent(c), noindex: true },
];
const enPath = (p) => (p === '/' ? '/en/' : `/en${p}`);

for (const p of PAGES) {
  const paths = { bg: p.path, en: enPath(p.path) };
  for (const c of [bg, en]) {
    const own = paths[c.lang];
    write(join(own, 'index.html'), layout({
      c, prod, site: SITE, tracking,
      page: {
        meta: p.meta(c), canonical: own, noindex: p.noindex, jsonld: p.jsonld,
        switch: paths,
        alternates: p.noindex ? null : [['bg', paths.bg], ['en', paths.en], ['x-default', paths.bg]],
      },
      body: p.body(c),
    }));
  }
  if (!p.noindex && p.path !== '/privacy/') sitemap.push(paths);
}

// ── Apply questionnaire: /apply/ and /apply/result/ in both languages ──
// Not in the sitemap and noindex unless APPLY_INDEXABLE=true (the owner turns it on after the soft launch).
const applyIndexable = process.env.APPLY_INDEXABLE === 'true';
for (const [c, content] of [[bg, applyBg], [en, applyEn]]) {
  for (const mode of ['apply', 'result']) {
    const own = `${c.base}${mode === 'apply' ? '/apply/' : '/apply/result/'}`;
    write(join(own, 'index.html'), layout({
      c, prod, site: SITE, tracking,
      page: { meta: content.meta, canonical: own, noindex: mode === 'result' || !applyIndexable, bare: true, stylesheet: '/css/apply.css', switch: { bg: mode === 'apply' ? '/apply/' : '/apply/result/', en: mode === 'apply' ? '/en/apply/' : '/en/apply/result/' }, alternates: null },
      body: apply(content, content, { mode }),
    }));
  }
}
mkdirSync(join(out, 'js/apply'), { recursive: true });
for (const f of ['config.js', 'validate.js']) cpSync(join(root, 'lib/apply', f), join(out, 'js/apply', f));
cpSync(join(root, 'src/apply/client.js'), join(out, 'js/apply/client.js'));
cpSync(join(root, 'src/styles/apply.css'), join(out, 'css/apply.css'));

// Open Graph image: the hero portrait at 1200x630.
await sharp(join(root, 'images/nikolay-hero.jpeg')).resize(1200, 630, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82 }).toFile(join(out, 'img/og.jpg'));

cpSync(join(root, 'src/fonts'), join(out, 'fonts'), { recursive: true });
mkdirSync(join(out, 'css'), { recursive: true });
mkdirSync(join(out, 'js'), { recursive: true });
cpSync(join(root, 'src/styles/site.css'), join(out, 'css/site.css'));
cpSync(join(root, 'src/site.js'), join(out, 'js/site.js'));
cpSync(join(root, 'src/favicon.svg'), join(out, 'favicon.svg'));
if (tracking) cpSync(join(root, 'src/consent.js'), join(out, 'js/consent.js'));

// ── Pass-through: assets and routes not yet rebuilt ──────────────────
// Legacy pages stay byte-identical in production. /workshop is never edited.
for (const d of ['images', 'css/styles.css', 'js/main.js', 'workshop', 'thankyou', 'en/workshop']) {
  cpSync(join(root, d), join(out, d), { recursive: true });
}

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
  const base = process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : 'http://localhost:3456';
  html = html.replace(/(name="_next"\s+value=")https?:\/\/(?:www\.)?nekov\.com\//gi, `$1${base}/`);
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
  const alt = (paths) => ['bg', 'en'].map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE}${paths[l]}"/>`).join('\n') + `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${paths.bg}"/>`;
  const today = new Date().toISOString().slice(0, 10);
  const urls = sitemap.flatMap((paths) => [paths.bg, paths.en].map((loc) => `  <url>\n    <loc>${SITE}${loc}</loc>\n    <lastmod>${today}</lastmod>\n${alt(paths)}\n  </url>`));
  // /workshop is a separate landing page and keeps its own entries.
  for (const [bgp, enp] of [['/workshop/', '/en/workshop/']]) urls.push(...[bgp, enp].map((loc) => `  <url>\n    <loc>${SITE}${loc}</loc>\n${alt({ bg: bgp, en: enp })}\n  </url>`));
  write('llms.txt', llmsTxt(en, SITE));
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`);
}

console.log(`built ${prod ? 'PRODUCTION' : 'STAGING'} → ${out}`);

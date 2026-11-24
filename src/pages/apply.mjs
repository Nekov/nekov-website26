import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc } from '../layout.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Only clients explicitly marked cleared:true are ever shown. A logo file is used when present, otherwise the name as text. */
function clients() {
  let list = [];
  try { list = JSON.parse(readFileSync(join(ROOT, 'data/clients.json'), 'utf8')); } catch {}
  return list.filter((c) => c.cleared === true).map((c) => {
    const ext = ['svg', 'png', 'webp'].find((e) => existsSync(join(ROOT, 'images/clients', `${slug(c.name)}.${e}`)));
    return { name: c.name, logo: ext ? `/images/clients/${slug(c.name)}.${ext}` : null };
  });
}

/** Build-time configuration handed to the browser. Contains no secrets. */
export function applyConfig(env = process.env) {
  const price = (v, name) => (env[v] ? `${env[v]} €` : `[${name}] €`);
  return {
    calendarUrl: env.APPLY_CALENDAR_URL || env.NEXT_PUBLIC_CALENDLY_URL || 'https://calendly.com/nekov/nekov-s-week',
    resourceUrl: env.APPLY_RESOURCE_URL || '',
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || '',
    ladder: { show: env.SHOW_PRICE_LADDER === 'true', a: price('APPLY_PRICE_A', 'A'), b: price('APPLY_PRICE_B', 'B'), c: price('APPLY_PRICE_C', 'C') },
    clients: clients(),
  };
}

const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

/** The shell of the questionnaire. Everything inside #apply is rendered by /js/apply/client.js. */
export function apply(c, content, { mode = 'apply' } = {}) {
  const here = mode === 'result' ? '/apply/result/' : '/apply/';
  const sw = { bg: here, en: `/en${here}` };
  return `<div class="apply" data-mode="${mode}">
  <header class="apply__head">
    <a class="apply__brand" href="${c.base || '/'}${c.base ? '/' : ''}">${esc(c.ui.brand)}</a>
    <div class="lang" role="group" aria-label="${esc(c.ui.langLabel)}">
      <a href="${sw.bg}" data-lang="bg" hreflang="bg" lang="bg"${c.lang === 'bg' ? ' aria-current="true"' : ''}>БГ</a>
      <a href="${sw.en}" data-lang="en" hreflang="en" lang="en"${c.lang === 'en' ? ' aria-current="true"' : ''}>EN</a>
    </div>
  </header>
  <div id="apply" class="apply__app" aria-live="polite"><p class="apply__loading">${esc(c.ui.loading)}</p></div>
  <noscript><p class="apply__noscript">${esc(c.ui.noscript)}</p></noscript>
</div>
<script type="application/json" id="apply-content">${json(content)}</script>
<script type="application/json" id="apply-config">${json({ ...applyConfig(), mode, lang: c.lang, base: c.base })}</script>
<script type="module" src="/js/apply/client.js"></script>`;
}

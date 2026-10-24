const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export const CALENDLY = process.env.NEXT_PUBLIC_CALENDLY_URL || 'https://calendly.com/nekov/nekov-s-week';

/** Escape text and wrap every [bracketed] placeholder (nesting allowed) in a visible .ph span. */
export function t(str) {
  let out = '', depth = 0;
  for (const ch of String(str)) {
    if (ch === '[') { if (depth++ === 0) out += '<span class="ph">'; out += '['; }
    else if (ch === ']' && depth > 0) { out += ']'; if (--depth === 0) out += '</span>'; }
    else out += esc(ch);
  }
  return out + '</span>'.repeat(depth);
}

/** Render [placeholder] text visibly. */
export const ph = (s) => `<span class="ph">${esc(s)}</span>`;

const SAME_AS = ['https://www.linkedin.com/in/nekov/', 'https://youtube.com/@NekovTalks', 'https://open.spotify.com/show/0Z8nmqnYq5uEvV0f5uHyLe'];

function jsonld(c, site) {
  const person = { '@type': 'Person', '@id': `${site}/#person`, name: 'Николай Неков', alternateName: 'Nikolay Nekov', url: `${site}/`, jobTitle: c.lang === 'en' ? 'Venture builder and business consultant' : 'Venture builder и бизнес консултант', sameAs: SAME_AS };
  const service = { '@type': 'ProfessionalService', '@id': `${site}/#service`, name: 'Nikolay Nekov', url: `${site}/`, founder: { '@id': `${site}/#person` }, sameAs: SAME_AS, areaServed: 'BG' };
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [person, service] }).replace(/</g, '\\u003c')}</script>`;
}

function head({ c, page, prod, site }) {
  const m = page.meta || c.meta;
  const canonical = prod && page.canonical ? `<link rel="canonical" href="${site}${page.canonical}">` : '';
  const alt = prod && page.alternates
    ? page.alternates.map(([l, p]) => `<link rel="alternate" hreflang="${l}" href="${site}${p}">`).join('\n  ')
    : '';
  return `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(m.title)}</title>
  <meta name="description" content="${esc(m.description)}">
  ${prod && !page.noindex ? '' : '<meta name="robots" content="noindex,nofollow">'}
  ${canonical}
  ${alt}
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(m.title)}">
  <meta property="og:description" content="${esc(m.description)}">
  <meta property="og:image" content="${site}/img/og.jpg">
  <meta property="og:locale" content="${c.lang === 'en' ? 'en_US' : 'bg_BG'}">
  ${prod && page.canonical ? `<meta property="og:url" content="${site}${page.canonical}">` : ''}
  ${prod && page.jsonld ? jsonld(c, site) : ''}
  <link rel="preload" href="/fonts/source-serif-4-${c.lang === 'bg' ? 'cyrillic' : 'latin'}-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/inter-${c.lang === 'bg' ? 'cyrillic' : 'latin'}-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/css/site.css">
</head>`;
}

function nav(c, page) {
  const n = c.nav;
  const items = n.links.map(([t, h]) => `<li><a href="${h}">${esc(t)}</a></li>`).join('');
  const sw = page.switch || { bg: '/', en: '/en/' };
  return `<header class="nav">
  <div class="wrap nav__inner">
    <a class="nav__brand" href="${c.base || '/'}${c.base ? '/' : ''}">${esc(n.brand)}</a>
    <button class="nav__toggle" type="button" aria-expanded="false" aria-controls="nav-panel" aria-label="${esc(n.menuLabel)}">${esc(n.menu)}</button>
    <div class="nav__panel" id="nav-panel">
      <nav aria-label="${esc(n.brand)}"><ul class="nav__links">${items}</ul></nav>
    </div>
    <div class="lang" role="group" aria-label="${esc(n.langLabel)}">
      <a href="${sw.bg}" data-lang="bg" hreflang="bg" lang="bg"${c.lang === 'bg' ? ' aria-current="true"' : ''}>БГ</a>
      <a href="${sw.en}" data-lang="en" hreflang="en" lang="en"${c.lang === 'en' ? ' aria-current="true"' : ''}>EN</a>
    </div>
    <a class="btn btn--brass nav__cta" href="${CALENDLY}" target="_blank" rel="noopener">${esc(n.cta)}</a>
  </div>
</header>`;
}

function footer(c, tracking) {
  const f = c.footer;
  return `<footer class="footer">
  <div class="wrap footer__inner">
    <p>${esc(f.copy)}</p>
    <p>
      <a href="https://www.linkedin.com/in/nekov/" target="_blank" rel="noopener">LinkedIn</a>
      <a href="https://youtube.com/@NekovTalks" target="_blank" rel="noopener">YouTube</a>
      <a href="https://open.spotify.com/show/0Z8nmqnYq5uEvV0f5uHyLe" target="_blank" rel="noopener">Spotify</a>
      <a href="${c.base}/privacy/">${esc(f.privacy)}</a>
      <a href="mailto:${f.email}">${f.email}</a>
      ${tracking ? `<button type="button" class="linklike" data-consent-open>${esc(c.consent.settings)}</button>` : ''}
    </p>
  </div>
</footer>`;
}

/** Only emitted when ENABLE_TRACKING=true in production: consent banner plus the gated loader. */
function consentBlock(c) {
  const k = c.consent;
  const cfg = JSON.stringify({ ga4: process.env.GA4_ID || '', pixel: process.env.FB_PIXEL_ID || '' }).replace(/</g, '\\u003c');
  return `<div class="consent-banner" id="consent-banner" role="region" aria-label="${esc(k.label)}" hidden>
    <p>${esc(k.text)} <a href="${c.base}/privacy/">${esc(k.more)}</a></p>
    <div><button type="button" class="btn btn--outline" data-consent="denied">${esc(k.decline)}</button> <button type="button" class="btn btn--brass" data-consent="granted">${esc(k.accept)}</button></div>
  </div>
  <script type="application/json" id="trk-config">${cfg}</script>
  <script src="/js/consent.js" defer></script>`;
}

export function layout({ c, page, body, prod, site, tracking = false }) {
  return `<!doctype html>
<html lang="${c.lang}">
${head({ c, page, prod, site })}
<body>
  <a class="skip" href="#main">${esc(c.skip)}</a>
  ${nav(c, page)}
  <main id="main">
${body}
  </main>
  ${footer(c, tracking)}
  <script src="/js/site.js" defer></script>
  ${tracking ? consentBlock(c) : ''}
</body>
</html>
`;
}

export { esc };

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
  <link rel="preload" href="/fonts/source-serif-4-${c.lang === 'bg' ? 'cyrillic' : 'latin'}-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/css/site.css">
</head>`;
}

function nav(c, page) {
  const n = c.nav;
  const items = n.links.map(([t, h]) => `<li><a href="${h}">${esc(t)}</a></li>`).join('');
  const sw = page.switch || { bg: '/', en: '/en/' };
  return `<header class="nav">
  <div class="wrap nav__inner">
    <a class="nav__brand" href="/">${esc(n.brand)}</a>
    <button class="nav__toggle" type="button" aria-expanded="false" aria-controls="nav-panel" aria-label="${esc(n.menuLabel)}">${esc(n.menu)}</button>
    <div class="nav__panel" id="nav-panel">
      <nav aria-label="${esc(n.brand)}"><ul class="nav__links">${items}</ul></nav>
    </div>
    <div class="lang" role="group" aria-label="${esc(n.langLabel)}">
      <a href="${sw.bg}" hreflang="bg" lang="bg"${c.lang === 'bg' ? ' aria-current="true"' : ''}>БГ</a>
      <a href="${sw.en}" hreflang="en" lang="en"${c.lang === 'en' ? ' aria-current="true"' : ''}>EN</a>
    </div>
    <a class="btn btn--brass nav__cta" href="${CALENDLY}" target="_blank" rel="noopener">${esc(n.cta)}</a>
  </div>
</header>`;
}

function footer(c) {
  const f = c.footer;
  return `<footer class="footer">
  <div class="wrap footer__inner">
    <p>${esc(f.copy)}${ph(f.legal)}</p>
    <p>
      <a href="https://www.linkedin.com/in/nekov/" target="_blank" rel="noopener">LinkedIn</a>
      <a href="https://youtube.com/@NekovTalks" target="_blank" rel="noopener">YouTube</a>
      <a href="https://open.spotify.com/show/0Z8nmqnYq5uEvV0f5uHyLe" target="_blank" rel="noopener">Spotify</a>
      <a href="/privacy/">${esc(f.privacy)}</a>
      <a href="mailto:${f.email}">${f.email}</a>
    </p>
  </div>
</footer>`;
}

export function layout({ c, page, body, prod, site }) {
  return `<!doctype html>
<html lang="${c.lang}">
${head({ c, page, prod, site })}
<body>
  <a class="skip" href="#main">${esc(c.skip)}</a>
  ${nav(c, page)}
  <main id="main">
${body}
  </main>
  ${footer(c)}
  <script src="/js/site.js" defer></script>
</body>
</html>
`;
}

export { esc };

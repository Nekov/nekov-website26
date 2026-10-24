// First-visit language choice for the bare "/" only. Cookie first, then Accept-Language. Never IP.
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|lighthouse|pagespeed|headless/i;

/** Primary language of the highest-weighted Accept-Language entry, or null. */
export function preferredLanguage(header) {
  if (!header) return null;
  const entries = header.split(',').map((part, i) => {
    const [tag, ...params] = part.trim().split(';');
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
    return { lang: tag.trim().toLowerCase().split('-')[0], q: q ? Number(q.slice(2)) : 1, i };
  }).filter((e) => e.lang && e.lang !== '*' && e.q > 0);
  entries.sort((a, b) => b.q - a.q || a.i - b.i);
  return entries[0]?.lang ?? null;
}

/** Returns "/en/" when the visitor should be sent to the English homepage, otherwise null. */
export function languageRedirect({ method, pathname, cookie = '', userAgent = '', acceptLanguage = '' }) {
  if (pathname !== '/' || (method !== 'GET' && method !== 'HEAD')) return null;
  const saved = /(?:^|;\s*)lang=(bg|en)(?:;|$)/.exec(cookie);
  if (saved) return saved[1] === 'en' ? '/en/' : null;
  if (BOT.test(userAgent)) return null;
  const lang = preferredLanguage(acceptLanguage);
  return lang && lang !== 'bg' ? '/en/' : null;
}

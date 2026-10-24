import { isProduction } from './lib/env.js';
import { languageRedirect } from './lib/lang.js';

export const config = { matcher: '/((?!_vercel).*)' };

const NOINDEX = 'noindex, nofollow';

function unauthorized() {
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Staging", charset="UTF-8"',
      'X-Robots-Tag': NOINDEX,
      'Cache-Control': 'no-store',
    },
  });
}

function authorized(request, user, pass) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  let decoded;
  try {
    decoded = new TextDecoder().decode(Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0)));
  } catch {
    return false;
  }
  const i = decoded.indexOf(':');
  return i > -1 && decoded.slice(0, i) === user && decoded.slice(i + 1) === pass;
}

function redirectTo(request, path, extra = {}) {
  return new Response(null, {
    status: 302,
    headers: { Location: new URL(path, request.url).toString(), Vary: 'Accept-Language, Cookie', 'Cache-Control': 'no-store', ...extra },
  });
}

export default function middleware(request) {
  const prod = isProduction();
  const { STAGING_USER, STAGING_PASS } = process.env;

  // Basic auth is the fallback when Deployment Protection is unavailable. Never in production.
  if (!prod && STAGING_USER && STAGING_PASS && !authorized(request, STAGING_USER, STAGING_PASS)) return unauthorized();

  const extra = prod ? {} : { 'X-Robots-Tag': NOINDEX };

  const target = languageRedirect({
    method: request.method,
    pathname: new URL(request.url).pathname,
    cookie: request.headers.get('cookie') || '',
    userAgent: request.headers.get('user-agent') || '',
    acceptLanguage: request.headers.get('accept-language') || '',
  });
  if (target) return redirectTo(request, target, extra);

  // Production adds nothing. Staging continues to the static file with noindex.
  if (prod) return undefined;
  return new Response(null, { headers: { 'x-middleware-next': '1', ...extra } });
}

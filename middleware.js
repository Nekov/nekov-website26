import { isProduction } from './lib/env.js';

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

export default function middleware(request) {
  // Production: do nothing at all.
  if (isProduction()) return undefined;

  const { STAGING_USER, STAGING_PASS } = process.env;
  // Basic auth is the fallback when Deployment Protection is unavailable.
  if (STAGING_USER && STAGING_PASS && !authorized(request, STAGING_USER, STAGING_PASS)) {
    return unauthorized();
  }

  // Continue to the static file, adding noindex to the response.
  return new Response(null, {
    headers: { 'x-middleware-next': '1', 'X-Robots-Tag': NOINDEX },
  });
}

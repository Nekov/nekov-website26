import { resultHandler } from '../../lib/apply/handlers.js';

// GET /api/apply/result/?t=<signed token>. A query parameter, not a dynamic path segment:
// dynamic function routes did not resolve on Vercel with trailing slashes enabled.
export const GET = (request) => resultHandler(request, new URL(request.url).searchParams.get('t') || '');

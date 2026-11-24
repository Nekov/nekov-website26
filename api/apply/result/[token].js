import { resultHandler } from '../../../lib/apply/handlers.js';
export const GET = (request) => {
  const token = new URL(request.url).pathname.split('/').filter(Boolean).pop(); // tolerate a trailing slash
  return resultHandler(request, decodeURIComponent(token));
};

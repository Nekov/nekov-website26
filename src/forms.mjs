// Where a form posts. FormSubmit blocks requests from cloud servers (403), so the visitor's browser
// posts to it directly, like the old site did. The alias is not a secret: it only hides the address.
// Without FORMSUBMIT_ALIAS (local dev) the form falls back to our own /api/contact/ endpoint.
import { isProduction } from '../lib/env.js';

const prod = isProduction();
const alias = process.env.FORMSUBMIT_ALIAS || '';
const site = prod ? 'https://www.nekov.com'
  : process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}`
  : 'http://localhost:3456';

const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const hidden = (name, value) => `<input type="hidden" name="${name}" value="${attr(value)}">`;

/** Returns { action, fields }: the form action and the hidden inputs to render inside it. */
export function formTarget({ subject, nextPath = '/sent/', nextUrl }) {
  if (!alias) {
    return { action: '/api/contact/', fields: '<p class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></p>' };
  }
  return {
    action: `https://formsubmit.co/${alias}`,
    fields: [
      hidden('_subject', `${prod ? '' : '[STAGING] '}${subject}`),
      hidden('_next', nextUrl || `${site}${nextPath}`),
      hidden('_captcha', 'false'),
      hidden('_template', 'table'),
      '<input type="text" name="_honey" style="display:none" tabindex="-1" autocomplete="off">',
    ].join('\n      '),
  };
}

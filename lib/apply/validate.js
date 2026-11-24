import { QUESTIONS, applicableKeys, isApplicable } from './config.js';

/** Validates one answer. Returns { ok: true, value } with the normalised value, or { ok: false, error }. */
export function validateAnswer(key, value, answers = {}) {
  const q = QUESTIONS[key];
  if (!q) return { ok: false, error: 'unknown_question' };
  if (!isApplicable(key, answers)) return { ok: false, error: 'not_applicable' };

  if (q.type === 'single') {
    if (typeof value !== 'string' || !q.options.includes(value)) return { ok: false, error: 'invalid_option' };
    return { ok: true, value };
  }
  if (q.type === 'multi') {
    if (!Array.isArray(value)) return { ok: false, error: 'invalid_option' };
    const uniq = [...new Set(value)];
    if (!uniq.every((v) => typeof v === 'string' && q.options.includes(v))) return { ok: false, error: 'invalid_option' };
    if (q.exclusive && uniq.includes(q.exclusive) && uniq.length > 1) return { ok: false, error: 'exclusive_conflict' };
    if (q.max && uniq.length > q.max) return { ok: false, error: 'too_many' };
    if (q.required && uniq.length < (q.min || 1)) return { ok: false, error: 'required' };
    return { ok: true, value: uniq };
  }
  // text
  if (typeof value !== 'string') return { ok: false, error: 'invalid_text' };
  const v = value.trim();
  if (q.required && !v) return { ok: false, error: 'required' };
  if (v && q.min && v.length < q.min) return { ok: false, error: 'too_short' };
  if (v.length > (q.max || 2000)) return { ok: false, error: 'too_long' };
  return { ok: true, value: v };
}

/** Required questions that are still unanswered (or invalid) for these answers. */
export function missingRequired(answers) {
  return applicableKeys(answers).filter((k) => {
    if (!QUESTIONS[k].required) return false;
    return !(k in answers) || !validateAnswer(k, answers[k], answers).ok;
  });
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+()\d][\d\s().-]{5,19}$/;
const CHANNELS = ['viber', 'whatsapp', 'phone', 'email'];

/** Contact block. Contact consent is mandatory and must be an explicit true. */
export function validateContact(c = {}) {
  const errors = {};
  const name = String(c.name ?? '').trim();
  const email = String(c.email ?? '').trim();
  const phone = String(c.phone ?? '').trim();
  const link = String(c.link ?? '').trim();
  const channel = c.channel ? String(c.channel) : '';
  if (!name || name.length > 120) errors.name = 'required';
  if (!EMAIL.test(email) || email.length > 200) errors.email = 'invalid_email';
  if (phone && !PHONE.test(phone)) errors.phone = 'invalid_phone';
  if (link && (link.length > 300 || /\s/.test(link))) errors.link = 'invalid_link';
  if (channel && (!CHANNELS.includes(channel) || !phone)) errors.channel = 'invalid_channel';
  if (c.consent_contact !== true) errors.consent_contact = 'required';
  const ok = Object.keys(errors).length === 0;
  return { ok, errors, value: ok ? { name, email, phone: phone || null, channel: channel || null, link: link || null, consent_contact: true, consent_marketing: c.consent_marketing === true } : null };
}

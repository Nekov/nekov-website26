import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBg } from '../src/apply/content.bg.mjs';
import { applyEn } from '../src/apply/content.en.mjs';
import { QUESTIONS } from '../lib/apply/config.js';

const paths = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? paths(v, `${p}${k}.`) : [`${p}${k}`]));
const get = (o, p) => p.split('.').reduce((x, k) => x?.[k], o);

test('Bulgarian and English cover exactly the same keys (100%)', () => {
  const bg = paths(applyBg).sort(), en = paths(applyEn).sort();
  assert.deepEqual(bg.filter((k) => !en.includes(k)), [], 'missing in English');
  assert.deepEqual(en.filter((k) => !bg.includes(k)), [], 'missing in Bulgarian');
});
test('every question has a title, and every option value in the config has a label, in both languages', () => {
  for (const c of [applyBg, applyEn]) for (const [key, q] of Object.entries(QUESTIONS)) {
    assert.ok(c.q[key]?.title, `${c.lang} ${key} title`);
    for (const o of q.options || []) assert.ok(c.q[key].options?.[o], `${c.lang} ${key}.${o}`);
    for (const o of Object.keys(c.q[key].options || {})) assert.ok((q.options || []).includes(o), `${c.lang} ${key} has stray label ${o}`);
  }
});
test('every obstacle answer has a personalised note, in both languages', () => {
  for (const c of [applyBg, applyEn]) for (const k of ['a4', 'b4', 'c4']) for (const o of QUESTIONS[k].options) assert.ok(c.notes[`${k}=${o}`], `${c.lang} ${k}=${o}`);
});
test('every task has a Card C2 row with a one-sentence summary', () => {
  for (const c of [applyBg, applyEn]) for (const t of QUESTIONS.g4.options.filter((o) => o !== 'nothing')) { assert.ok(c.cards.c2.rows[t]?.title); assert.ok(c.cards.c2.rows[t]?.short); }
});
test('no time promises ("48 hours", "3 days") anywhere in the apply copy', () => {
  for (const c of [applyBg, applyEn]) assert.doesNotMatch(JSON.stringify(c), /48\s?(ч|h)|\b3\s?(дни|days)\b/i);
});
test('the visitor never sees internal tier names in the copy', () => {
  for (const c of [applyBg, applyEn]) assert.doesNotMatch(JSON.stringify(c), /GREEN|YELLOW|\bRED\b/);
});
test('the quote keeps the approved attribution: Senior Manager, PayPal Australia', () => {
  for (const c of [applyBg, applyEn]) { assert.equal(c.cards.c3.quote.who, 'Lloyd Butler'); assert.equal(c.cards.c3.quote.role, 'Senior Manager, PayPal Australia'); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, publicResult, readiness, level } from '../lib/apply/scoring.js';
import { steps, prune, questionScreenCount, applicableKeys } from '../lib/apply/config.js';
import { validateAnswer, missingRequired, validateContact } from '../lib/apply/validate.js';

const LONG = 'Достатъчно дълъг отговор за целта на теста.'; // >= 20 chars
const base = { stage: 'idea', work: 'corporate', a3: '6_20', g1: 'gt5', g2: 'team', g3: 'guide', g4: ['launch'], g5: LONG, g6: 'monthly' };

// ── The five cases from the brief (§9) ──
test('T1: GREEN, 12 points, index 93', () => {
  const r = evaluate(base);
  assert.equal(r.score_points, 12); assert.equal(r.tier, 'GREEN'); assert.equal(r.readiness, 93);
});
test('T2: YELLOW, 5 points, index 49', () => {
  const r = evaluate({ ...base, a3: '1_5', g1: '2_5', g2: 'hire_or_none', g3: 'task', g5: 'десет знак', g6: 'consult' });
  assert.equal(r.score_points, 5); assert.equal(r.tier, 'YELLOW'); assert.equal(r.readiness, 49);
});
test('T3: g3=alone is RED even with everything else maximal', () => {
  assert.equal(evaluate({ ...base, g3: 'alone', g6: 'monthly' }).tier, 'RED');
});
test('T4: guide + below_consult is RED with index 87, and the high-index note is offered', () => {
  const a = { ...base, g3: 'guide', g6: 'below_consult', a3: '1_5', g2: 'me' };
  const r = evaluate(a);
  assert.equal(r.tier, 'RED'); assert.equal(r.readiness, 87);
  assert.equal(publicResult(a).highIndexAffordableStep, true);
});
test('T5: course + project is YELLOW with the diy_big_budget flag', () => {
  const r = evaluate({ ...base, g3: 'course', g6: 'project' });
  assert.equal(r.tier, 'YELLOW'); assert.deepEqual(r.flags, ['diy_big_budget']);
});

// ── More rules ──
test('browsing is always RED', () => assert.equal(evaluate({ stage: 'browsing', work: 'corporate' }).tier, 'RED'));
test('below_consult is RED regardless of attitude', () => assert.equal(evaluate({ ...base, g6: 'below_consult' }).tier, 'RED'));
test('"unknown" budget with an open attitude reaches YELLOW (review), not RED', () => assert.equal(evaluate({ ...base, g3: 'task', g6: 'unknown' }).tier, 'YELLOW'));
test('GREEN needs a project/monthly budget', () => assert.equal(evaluate({ ...base, g6: 'consult' }).tier, 'YELLOW'));
test('readiness ignores the budget', () => assert.equal(readiness({ ...base, g6: 'monthly' }), readiness({ ...base, g6: 'below_consult' })));
test('levels: <40 solo, 40-69 targeted, >=70 partner', () => { assert.equal(level(39), 'solo'); assert.equal(level(40), 'targeted'); assert.equal(level(69), 'targeted'); assert.equal(level(70), 'partner'); });
test('noidea uses the neutral action score', () => assert.equal(evaluate({ ...base, stage: 'noidea', a3: undefined }).score_breakdown.action, 1));

test('visitor-facing result never leaks points, tier names or breakdown', () => {
  for (const a of [base, { ...base, g3: 'alone' }, { ...base, g3: 'course', g6: 'project' }]) {
    const json = JSON.stringify(publicResult(a));
    assert.doesNotMatch(json, /GREEN|YELLOW|RED|points|breakdown|tier|diy_big_budget/i);
  }
});

// ── Flow ──
test('screen counts match the brief: A 13 (+1 with g7), B and C 14 (+1)', () => {
  assert.equal(questionScreenCount({ stage: 'idea' }), 13);
  assert.equal(questionScreenCount({ stage: 'noidea' }), 13);
  assert.equal(questionScreenCount({ stage: 'launched' }), 14);
  assert.equal(questionScreenCount({ stage: 'running' }), 14);
  assert.equal(questionScreenCount({ stage: 'idea', g6: 'below_consult' }), 14);
  assert.equal(questionScreenCount({ stage: 'running', g6: 'unknown' }), 15);
});
test('browsing ends after the work question', () => assert.deepEqual(steps({ stage: 'browsing' }).map((s) => s.key), ['stage', 'work']));
test('measuring questions come before the explanatory cards (C2/C3 come after g4/g5)', () => {
  const keys = steps({ stage: 'idea' }).map((s) => s.key);
  assert.ok(keys.indexOf('card_c1') < keys.indexOf('ai'));
  assert.ok(keys.indexOf('g4') < keys.indexOf('card_c2')); assert.ok(keys.indexOf('g5') < keys.indexOf('card_c3')); assert.ok(keys.indexOf('card_c3') < keys.indexOf('g6'));
});
test('ai2 only applies when ai1 is not "never"', () => { assert.ok(!applicableKeys({ ai1: 'never' }).includes('ai2')); assert.ok(applicableKeys({ ai1: 'tried_little' }).includes('ai2')); });
test('changing the stage prunes answers of the old profile', () => {
  const p = prune({ stage: 'running', c1: 'x', c2: 'lt3k', g3: 'task' });
  assert.equal(p.c1, 'x');
  const q = prune({ stage: 'launched', c1: 'x', c2: 'lt3k', g3: 'task' });
  assert.equal(q.c1, undefined); assert.equal(q.g3, 'task');
});

// ── Validation ──
test('single: only listed values', () => { assert.ok(validateAnswer('g3', 'guide', {}).ok); assert.equal(validateAnswer('g3', 'hacker', {}).error, 'invalid_option'); });
test('multi: exclusive option cannot be combined', () => assert.equal(validateAnswer('g4', ['nothing', 'launch'], {}).error, 'exclusive_conflict'));
test('multi: ai2 allows at most two', () => assert.equal(validateAnswer('ai2', ['generic', 'no_priority', 'enough'], { ai1: 'tried_little' }).error, 'too_many'));
test('text: a1 needs 20+ characters', () => { assert.equal(validateAnswer('a1', 'къс', { stage: 'idea' }).error, 'too_short'); assert.ok(validateAnswer('a1', LONG, { stage: 'idea' }).ok); });
test('answers for a profile that does not apply are rejected', () => assert.equal(validateAnswer('c2', 'lt3k', { stage: 'idea' }).error, 'not_applicable'));
test('optional text may be empty', () => assert.ok(validateAnswer('g5', '', {}).ok));
test('missingRequired lists what is left', () => {
  const m = missingRequired({ stage: 'idea', work: 'corporate' });
  for (const k of ['a1', 'a2', 'a3', 'a4', 'ai1', 'g1', 'g2', 'g3', 'g4', 'g6']) assert.ok(m.includes(k), k);
  assert.ok(!m.includes('g5'));
  assert.deepEqual(missingRequired({ ...base, a1: LONG, a2: 'plan', a4: 'no_clients', ai1: 'never' }), []);
});
test('contact: consent is mandatory, email must be valid', () => {
  const ok = { name: 'Тест', email: 'a@b.co', consent_contact: true };
  assert.ok(validateContact(ok).ok);
  assert.equal(validateContact({ ...ok, consent_contact: false }).errors.consent_contact, 'required');
  assert.equal(validateContact({ ...ok, consent_contact: 'true' }).errors.consent_contact, 'required');
  assert.equal(validateContact({ ...ok, email: 'nope' }).errors.email, 'invalid_email');
  assert.ok(validateContact({ ...ok, phone: '+359 88 123 4567', channel: 'viber' }).ok);
  assert.equal(validateContact({ ...ok, channel: 'viber' }).errors.channel, 'invalid_channel'); // channel needs a phone
});

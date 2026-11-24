// Single source of truth for the "apply" questionnaire: ids, types, allowed values, rules, flow.
// Copy (labels, texts) lives in the language files; the server only needs values and rules.
const single = (options, extra = {}) => ({ type: 'single', required: true, options, ...extra });
const multi = (options, extra = {}) => ({ type: 'multi', required: true, options, min: 1, ...extra });
const text = (extra = {}) => ({ type: 'text', required: false, max: 2000, ...extra });
const is = (key, ...vals) => (a) => vals.includes(a[key]);

export const QUESTIONS = {
  stage: single(['idea', 'noidea', 'launched', 'running', 'browsing']),
  work: single(['corporate', 'corporate_side', 'own_full', 'freelance', 'transition']),

  // Profile A
  a1: text({ required: true, min: 20, when: is('stage', 'idea') }),
  a2: single(['only_idea', 'plan', 'prototype', 'tests'], { when: is('stage', 'idea') }),
  a3: single(['0', '1_5', '6_20', 'gt20'], { when: is('stage', 'idea') }),
  n1: text({ required: true, when: is('stage', 'noidea') }),
  n2: single(['service', 'product', 'online', 'physical', 'undecided'], { when: is('stage', 'noidea') }),
  n3: multi(['time', 'capital', 'risk', 'none'], { exclusive: 'none', when: is('stage', 'noidea') }),
  a4: single(['no_clients', 'unsure_idea', 'no_time', 'no_team_skills', 'dont_know_first', 'other'], { when: is('stage', 'idea', 'noidea') }),
  a4_other: text({ max: 500, when: (a) => a.a4 === 'other' && ['idea', 'noidea'].includes(a.stage) }),

  // Profile B
  b1: text({ required: true, when: is('stage', 'launched') }),
  b2: single(['lt10', '10_50', '50_200', 'gt200', 'unknown'], { when: is('stage', 'launched') }),
  b3: single(['0', '1_3', '4_10', 'gt10'], { when: is('stage', 'launched') }),
  b4: single(['dont_understand', 'wrong_audience', 'price', 'product_quality', 'no_reach', 'dont_know'], { when: is('stage', 'launched') }),
  b5: text({ when: is('stage', 'launched') }),

  // Profile C
  c1: text({ required: true, when: is('stage', 'running') }),
  c2: single(['lt3k', '3_10k', '10_30k', 'gt30k', 'no_say'], { when: is('stage', 'running') }),
  c3: single(['decline', 'flat', 'slow', 'below_expectations'], { when: is('stage', 'running') }),
  c4: single(['no_new_clients', 'no_repeat', 'depends_on_me', 'margins', 'competition', 'dont_know'], { when: is('stage', 'running') }),
  c5: text({ when: is('stage', 'running') }),

  // Market research (not scored). `enough` stays in the list on purpose.
  ai1: single(['never', 'tried_little', 'regular_tasks', 'tried_full']),
  ai2: multi(['generic', 'dont_know_prompt', 'no_priority', 'no_accountability', 'no_time_execute', 'enough'], { max: 2, when: (a) => a.ai1 && a.ai1 !== 'never' }),

  // Capacity, attitude, tasks
  g1: single(['lt2', '2_5', 'gt5']),
  g2: single(['me', 'team', 'hire_or_none']),
  g3: single(['alone', 'course', 'task', 'partner', 'guide']),
  g4: multi(['launch', 'marketing', 'brand_site', 'event', 'plan_invest', 'direction', 'nothing'], { exclusive: 'nothing' }),
  g5: text({ max: 1000 }),

  // Budget
  g6: single(['below_consult', 'consult', 'project', 'monthly', 'unknown']),
  g7: multi(['group', 'workshop', 'course', 'free_only', 'none'], { exclusive: 'none', when: is('g6', 'below_consult', 'unknown') }),
};

export const profileOf = (stage) => ({ idea: 'A', noidea: 'A', launched: 'B', running: 'C' }[stage] || 'none');

const PROFILE_STEPS = {
  idea: [['a1'], ['a2'], ['a3'], ['a4', 'a4_other']],
  noidea: [['n1'], ['n2'], ['n3'], ['a4', 'a4_other']],
  launched: [['b1'], ['b2'], ['b3'], ['b4'], ['b5']],
  running: [['c1'], ['c2'], ['c3'], ['c4'], ['c5']],
};

const q = (...questions) => ({ key: questions[0], questions });
const card = (key) => ({ key, card: true });

/** The screens a given set of answers walks through, in order. Cards are not question steps. */
export function steps(a = {}) {
  const s = [q('stage'), q('work')];
  if (a.stage === 'browsing') return s; // ends on the thank-you screen
  s.push(card('card_c1'));
  for (const qs of PROFILE_STEPS[a.stage] || []) s.push(q(...qs));
  s.push({ key: 'ai', questions: ['ai1', 'ai2'] });
  s.push({ key: 'capacity', questions: ['g1', 'g2'] });
  s.push(q('g3'), q('g4'), card('card_c2'), q('g5'), card('card_c3'), q('g6'));
  if (QUESTIONS.g7.when(a)) s.push(q('g7'));
  s.push({ key: 'contact', contact: true });
  return s;
}

export const isApplicable = (key, a) => QUESTIONS[key] && (!QUESTIONS[key].when || QUESTIONS[key].when(a));

/** Question keys that apply to these answers. */
export const applicableKeys = (a) => Object.keys(QUESTIONS).filter((k) => isApplicable(k, a));

/** Drop answers that no longer apply (e.g. after the visitor changes their stage). */
export function prune(a) {
  let out = { ...a };
  for (let i = 0; i < 3; i++) for (const k of Object.keys(out)) if (!isApplicable(k, out)) delete out[k];
  return out;
}

export const questionSteps = (a) => steps(a).filter((s) => !s.card && !s.contact);
export const questionScreenCount = (a) => steps(a).filter((s) => !s.card).length; // includes the contact screen

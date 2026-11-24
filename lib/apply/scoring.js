// Server-side scoring. Two separate things:
//  - the internal qualification (points, tier, flags): never shown to the visitor;
//  - the readiness index 0-100: shown to the visitor, independent of budget.
// Weights and thresholds are a starting hypothesis, to be calibrated after the first 30-50 applications.
const OPENNESS = { alone: 0, course: 1, task: 2, partner: 3, guide: 3 };
const BUDGET = { below_consult: 0, unknown: 0, consult: 1, project: 3, monthly: 4 };
const TIME = { lt2: 0, '2_5': 1, gt5: 2 };
const ACTION = {
  idea: { key: 'a3', map: { '0': 0, '1_5': 1, '6_20': 2, gt20: 3 } },
  launched: { key: 'b2', map: { lt10: 0, '10_50': 1, '50_200': 2, gt200: 3, unknown: 0 } },
  running: { key: 'c2', map: { lt3k: 0, '3_10k': 1, '10_30k': 2, gt30k: 3, no_say: 0 } },
};
const NOIDEA_ACTION = 1; // neutral, to be calibrated

export function components(a) {
  const openness = OPENNESS[a.g3] ?? 0;
  const budget = BUDGET[a.g6] ?? 0;
  const time = TIME[a.g1] ?? 0;
  const exec = a.g2 && a.g2 !== 'hire_or_none' ? 1 : 0;
  let action = 0;
  if (a.stage === 'noidea') action = NOIDEA_ACTION;
  else if (ACTION[a.stage]) action = ACTION[a.stage].map[a[ACTION[a.stage].key]] ?? 0;
  const concrete = Array.isArray(a.g4) && a.g4.some((v) => v !== 'nothing');
  const urgency = (concrete ? 1 : 0) + (String(a.g5 || '').trim().length >= 20 ? 1 : 0);
  return { openness, budget, time, exec, action, urgency, capacity: time + exec };
}

/** Internal qualification. */
export function qualify(a) {
  const c = components(a);
  const points = c.budget + c.openness + c.action + c.time + c.exec;
  const flags = [];
  const bigBudget = a.g6 === 'project' || a.g6 === 'monthly';
  let tier;
  if (a.stage === 'browsing' || a.g3 === 'alone' || a.g6 === 'below_consult') tier = 'RED';
  else if (points >= 10 && bigBudget && c.openness >= 2) tier = 'GREEN';
  else if (c.openness >= 2) tier = 'YELLOW';
  else if (a.g3 === 'course' && bigBudget) { tier = 'YELLOW'; flags.push('diy_big_budget'); }
  else tier = 'RED';
  return { points, tier, flags, breakdown: c };
}

/** Readiness index 0-100. Does not use the budget, so it never reads as "you cannot afford it". */
export function readiness(a) {
  const c = components(a);
  return Math.round((c.openness / 3) * 40 + (c.capacity / 3) * 25 + (c.action / 3) * 20 + (c.urgency / 2) * 15);
}

export const level = (index) => (index >= 70 ? 'partner' : index >= 40 ? 'targeted' : 'solo');

const OBSTACLE = { idea: 'a4', noidea: 'a4', launched: 'b4', running: 'c4' };

/**
 * What the visitor is allowed to see. Deliberately contains no points and no tier name:
 * `cta` says what to offer next, not how the application was classified.
 */
export function publicResult(a) {
  const { tier } = qualify(a);
  const index = readiness(a);
  const obstacleKey = OBSTACLE[a.stage];
  return {
    readiness: index,
    level: level(index),
    obstacle: obstacleKey && a[obstacleKey] ? `${obstacleKey}=${a[obstacleKey]}` : null,
    tasks: Array.isArray(a.g4) ? a.g4.filter((t) => t !== 'nothing') : [],
    cta: tier === 'GREEN' ? 'call' : tier === 'YELLOW' ? 'review' : 'resource',
    highIndexAffordableStep: tier === 'RED' && index >= 70 && a.stage !== 'browsing',
    wantedFormats: Array.isArray(a.g7) ? a.g7.filter((f) => f !== 'none' && f !== 'free_only') : [],
  };
}

/** Full internal record to store. */
export function evaluate(a) {
  const q = qualify(a);
  return { score_points: q.points, score_breakdown: q.breakdown, tier: q.tier, flags: q.flags, readiness: readiness(a) };
}

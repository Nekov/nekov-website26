// Questionnaire UI. Plain ES module, no framework. Flow, rules and validation are imported from the same
// config the server uses, so what the screen accepts is exactly what the API accepts.
import { QUESTIONS, steps, questionScreenCount, isApplicable } from './config.js';
import { validateAnswer, validateContact } from './validate.js';

const $ = (s, r = document) => r.querySelector(s);
const C = JSON.parse($('#apply-content').textContent);
const CFG = JSON.parse($('#apply-config').textContent);
const root = $('#apply');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');
const store = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} },
};

const state = { answers: {}, saved: {}, key: 'welcome', maxPct: 0, timer: null, result: null, email: '', contact: JSON.parse(store.get('tf_contact') || '{}'), focusId: null, errors: {}, banner: '' };

// ── API ──────────────────────────────────────────────────────────────
async function api(method, path, body) {
  try {
    const r = await fetch('/api/apply' + path, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) });
    let data = null; try { data = await r.json(); } catch {}
    return { ok: r.ok, status: r.status, data };
  } catch { return { ok: false, status: 0, data: null }; }
}
const track = (type, stepKey) => { if (CFG.mode === 'apply') fetch('/api/apply/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ type, stepKey }), keepalive: true }).catch(() => {}); };

// ── Navigation (every screen is a history entry, so the browser's Back works) ──
function go(key, { push = true } = {}) {
  clearTimeout(state.timer);
  state.key = key; state.errors = {}; state.banner = '';
  if (push) history.pushState({ k: key }, '', location.pathname + location.search);
  render();
  const h = $('[data-title]', root); if (h) h.focus({ preventScroll: false });
  window.scrollTo({ top: 0, behavior: 'instant' }); // a new screen starts at the top at once; no animated scroll
  track(key.startsWith('card_') ? 'card_view' : 'step_view', key);
}
addEventListener('popstate', (e) => { const k = e.state && e.state.k; if (k) go(k, { push: false }); });

const stepList = () => steps(state.answers);
const idx = (key) => stepList().findIndex((s) => s.key === key);
const nextKey = (key) => { const l = stepList(); const i = l.findIndex((s) => s.key === key); return l[i + 1] ? l[i + 1].key : 'thanks'; };

// ── Progress: counts question screens only; the bar never moves backwards ──
function progress(key) {
  const l = stepList().filter((s) => !s.card);
  const n = Math.max(1, l.findIndex((s) => s.key === key) + 1);
  const t = state.answers.stage ? questionScreenCount(state.answers) : 13;
  state.maxPct = Math.max(state.maxPct, Math.round((n / t) * 100));
  return { n: Math.min(n, t), t, pct: state.maxPct };
}

// ── Answers ──────────────────────────────────────────────────────────
function localSet(q, v) { state.answers[q] = v; if (QUESTIONS[q].type === 'text') store.set('tf_draft_' + q, v); }
async function save(q) {
  const v = state.answers[q];
  if (JSON.stringify(state.saved[q]) === JSON.stringify(v)) return true;
  const r = await api('PATCH', '/answer', { key: q, value: v, stepKey: state.key });
  if (!r.ok) return false;
  state.saved[q] = v;
  state.answers = { ...r.data.answers }; // the server prunes answers that stopped applying
  return true;
}
const screenQs = (step) => (step.questions || []).filter((q) => isApplicable(q, state.answers));
function screenValid(step) {
  return screenQs(step).every((q) => {
    const Q = QUESTIONS[q]; const v = state.answers[q];
    if (!Q.required && (v === undefined || v === '' || (Array.isArray(v) && !v.length))) return true;
    return validateAnswer(q, v ?? (Q.type === 'multi' ? [] : ''), state.answers).ok;
  });
}

// ── Rendering helpers ────────────────────────────────────────────────
const L = (q) => C.q[q];
function optionHtml(q, value, type, checked, disabled) {
  const id = `${q}__${value}`;
  return `<label class="opt${checked ? ' is-on' : ''}${disabled ? ' is-disabled' : ''}"><input id="${id}" type="${type}" name="${q}" value="${esc(value)}"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}><span class="opt__box"><span class="opt__text">${esc(L(q).options[value])}</span><span class="opt__check" aria-hidden="true">✓</span></span></label>`;
}
function questionHtml(q, withTitle = true) {
  const Q = QUESTIONS[q], T = L(q), v = state.answers[q];
  const title = withTitle ? `<legend class="q__title" ${withTitle === 'main' ? 'data-title tabindex="-1"' : ''}>${esc(T.title)}${Q.required ? '' : ` <span class="q__opt">(${esc(C.ui.optional)})</span>`}</legend>` : '';
  if (Q.type === 'single') return `<fieldset class="q" data-q="${q}">${title}<div class="opts">${Q.options.map((o) => optionHtml(q, o, 'radio', v === o)).join('')}</div></fieldset>`;
  if (Q.type === 'multi') {
    const cur = Array.isArray(v) ? v : [];
    const atMax = Q.max && cur.length >= Q.max;
    const hint = Q.max ? fmt(C.ui.pickUpTo, { n: Q.max }) : C.ui.pickMany;
    return `<fieldset class="q" data-q="${q}">${title}<p class="q__hint">${esc(hint)}</p><div class="opts">${Q.options.map((o) => optionHtml(q, o, 'checkbox', cur.includes(o), atMax && !cur.includes(o))).join('')}</div></fieldset>`;
  }
  const val = v ?? store.get('tf_draft_' + q) ?? '';
  const chips = T.chips ? `<div class="chips" role="group" aria-label="${esc(T.title)}">${T.chips.map((c) => `<button type="button" class="chip" data-chip="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : '';
  const min = Q.min ? `<span class="counter" data-min="${Q.min}"></span>` : '<span class="counter"></span>';
  return `<div class="q" data-q="${q}"><label class="q__title" for="f_${q}" ${withTitle === 'main' ? 'data-title tabindex="-1"' : ''}>${esc(T.title)}${Q.required ? '' : ` <span class="q__opt">(${esc(C.ui.optional)})</span>`}</label><textarea id="f_${q}" rows="3" maxlength="${Q.max || 2000}" placeholder="${esc(T.placeholder || '')}" data-text="${q}">${esc(val)}</textarea>${chips}<div class="q__foot">${min}</div></div>`;
}
const err = (k) => (state.errors[k] ? `<p class="err" role="alert">${esc(state.errors[k])}</p>` : '');

function shell(inner, { key, back = true, bar = '' }) {
  const p = key ? progress(key) : null;
  return `${p ? `<div class="prog"><div class="prog__row">${back ? `<button type="button" class="back" data-act="back"><span aria-hidden="true">←</span> ${esc(C.ui.back)}</button>` : '<span></span>'}<span class="prog__label">${esc(fmt(C.ui.step, p))}</span></div><div class="prog__bar" role="progressbar" aria-label="${esc(C.ui.progress)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.pct}"><span style="width:${p.pct}%"></span></div></div>` : ''}
<div class="screen">${state.banner ? `<p class="err banner" role="alert">${esc(state.banner)}</p>` : ''}${inner}</div>${bar ? `<div class="bar">${bar}</div>` : ''}`;
}

// ── Screens ──────────────────────────────────────────────────────────
function welcome() {
  const W = C.welcome;
  return `<div class="screen screen--welcome"><p class="kicker">${esc(W.kicker)}</p><h1 data-title tabindex="-1">${esc(W.title)}</h1><p class="lead">${esc(W.lead)}</p><ul class="ticks">${W.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${state.resume ? `<div class="resume"><h2>${esc(C.ui.resumeTitle)}</h2><p>${esc(C.ui.resumeText)}</p><div class="resume__btns"><button class="btn btn--brass" data-act="resume">${esc(C.ui.resume)}</button><button class="btn btn--ghost" data-act="restart">${esc(C.ui.restart)}</button></div></div>` : `<button class="btn btn--brass btn--block" data-act="start">${esc(C.ui.start)}</button>`}</div>`;
}

function questionsScreen(step) {
  const qs = screenQs(step);
  const multi = step.questions.length > 1;
  const body = qs.map((q, i) => questionHtml(q, i === 0 ? 'main' : true)).join('') + (step.key === 'g6' ? ladder() : '');
  const needsNext = multi || qs.some((q) => QUESTIONS[q].type !== 'single') || step.key === 'a4';
  const optionalOnly = qs.every((q) => !QUESTIONS[q].required);
  const bar = needsNext ? `${optionalOnly ? `<button type="button" class="btn btn--ghost" data-act="skip">${esc(C.ui.skip)}</button>` : ''}<button type="button" class="btn btn--brass" data-act="next" ${screenValid(step) ? '' : 'disabled'}>${esc(C.ui.next)}</button>` : '';
  return shell(`${body}${err('save')}`, { key: step.key, bar });
}

function ladder() {
  const l = C.ladder, s = CFG.ladder;
  const row = (label, amount, suffix = '') => `<li><span>${esc(label)}</span>${s.show ? `<strong>${esc(l.from)} ${esc(amount)}${esc(suffix)}</strong>` : ''}</li>`;
  return `<aside class="ladder" aria-label="${esc(l.title)}"><p class="ladder__title">${esc(l.title)}</p><ul>${row(l.consult, s.a)}${row(l.project, s.b)}${row(l.monthly, s.c, ' ' + l.perMonth)}</ul></aside>`;
}

function card(key) {
  const next = `<div class="bar"><button type="button" class="btn btn--brass btn--block" data-act="cont">${esc(C.ui.cont)}</button></div>`;
  const prev = stepList().slice(0, idx(key)).reverse().find((s) => !s.card);
  const p = progress(prev ? prev.key : 'stage');
  const head = `<div class="prog"><div class="prog__row"><button type="button" class="back" data-act="back"><span aria-hidden="true">←</span> ${esc(C.ui.back)}</button><span class="prog__label">${esc(fmt(C.ui.step, p))}</span></div><div class="prog__bar" role="progressbar" aria-label="${esc(C.ui.progress)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.pct}"><span style="width:${p.pct}%"></span></div></div>`;
  let inner = '';
  if (key === 'card_c1') {
    const k = C.cards.c1, list = CFG.clients || [];
    const strip = list.length ? `<ul class="clients">${list.slice(0, 8).map((c) => `<li>${c.logo ? `<img src="${esc(c.logo)}" alt="${esc(c.name)}" height="28" loading="lazy">` : esc(c.name)}</li>`).join('')}<li class="clients__more">${esc(k.more)}</li></ul>` : '';
    inner = `<p class="kicker">${esc(k.kicker)}</p><h1 data-title tabindex="-1">${esc(k.title)}</h1><p class="lead">${esc(k.text)}</p>${strip}<p class="author">${esc(k.author)}</p>`;
  } else if (key === 'card_c2') {
    const k = C.cards.c2, picked = (state.answers.g4 || []).filter((t) => t !== 'nothing');
    const shown = picked.slice(0, 2);
    const rows = shown.map((t) => `<li><h2>${esc(k.rows[t].title)}</h2><p>${esc(k.rows[t].text)}</p></li>`).join('');
    inner = `<p class="kicker">${esc(k.kicker)}</p><h1 data-title tabindex="-1">${esc(k.title)}</h1>${rows ? `<ul class="rows">${rows}</ul>${picked.length > 2 ? `<p class="muted">${esc(k.more)}</p>` : ''}` : ''}<div class="how"><h2>${esc(k.howTitle)}</h2><ul class="ticks">${k.how.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><p class="words">${k.words.map((w) => `<span>${esc(w)}</span>`).join('')}</p></div>`;
  } else {
    const k = C.cards.c3;
    inner = `<p class="kicker">${esc(k.kicker)}</p><h1 data-title tabindex="-1">${esc(k.title)}</h1>
<section class="case"><h2>${esc(k.jaya.name)}</h2><p>${esc(k.jaya.text)}</p><p class="stats">${k.jaya.stats.map((s) => `<span>${esc(s)}</span>`).join('')}</p><p class="ph">${esc(k.jaya.note)}</p></section>
<section class="case"><h2>${esc(k.fixed.name)}</h2><p class="stats">${k.fixed.stats.map((s) => `<span>${esc(s)}</span>`).join('')}</p><p class="ph">${esc(k.fixed.note)}</p></section>
<figure class="quote"><blockquote lang="en"><p>${esc(k.quote.text)}</p></blockquote><figcaption><strong>${esc(k.quote.who)}</strong>, ${esc(k.quote.role)}</figcaption></figure>`;
  }
  return `${head}<div class="screen">${inner}</div>${next}`;
}

function contactScreen() {
  const K = C.contact, v = state.contact, e = state.errors;
  const f = (id, label, type, extra = '', req = true) => `<div class="field"><label for="c_${id}">${esc(label)}${req ? '' : ` <span class="q__opt">(${esc(C.ui.optional)})</span>`}</label><input id="c_${id}" name="${id}" type="${type}" value="${esc(v[id] || '')}" ${extra} aria-describedby="e_${id}">${e[id] ? `<p class="err" id="e_${id}" role="alert">${esc(K.errors[e[id]] || K.errors.generic)}</p>` : ''}</div>`;
  const channels = Object.entries(K.channels).map(([val, lab]) => `<option value="${val}"${v.channel === val ? ' selected' : ''}>${esc(lab)}</option>`).join('');
  const hasPhone = !!(v.phone || '').trim();
  return `<div class="prog"><div class="prog__row"><button type="button" class="back" data-act="back"><span aria-hidden="true">←</span> ${esc(C.ui.back)}</button><span class="prog__label">${esc(fmt(C.ui.step, progress('contact')))}</span></div><div class="prog__bar" role="progressbar" aria-label="${esc(C.ui.progress)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress('contact').pct}"><span style="width:${progress('contact').pct}%"></span></div></div>
<form class="screen contact" novalidate data-form="contact"><h1 data-title tabindex="-1">${esc(K.title)}</h1><p class="lead">${esc(K.lead)}</p>
${state.banner ? `<p class="err banner" role="alert">${esc(state.banner)}</p>` : ''}
<p class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></p>
${f('name', K.name, 'text', 'autocomplete="name" required')}
${f('email', K.email, 'email', 'autocomplete="email" inputmode="email" required')}
${f('phone', K.phone, 'tel', 'autocomplete="tel" inputmode="tel"', false)}
<div class="field" data-channel${hasPhone ? '' : ' hidden'}><label for="c_channel">${esc(K.channel)} <span class="q__opt">(${esc(C.ui.optional)})</span></label><select id="c_channel" name="channel"><option value=""></option>${channels}</select></div>
${f('link', K.link, 'url', 'autocomplete="url" inputmode="url"', false)}
<p class="why">${esc(K.why)} <a href="${C.base}/privacy/" target="_blank" rel="noopener">${esc(K.privacyLink)}</a></p>
<label class="check"><input type="checkbox" name="consent_contact"${v.consent_contact ? ' checked' : ''}><span>${esc(K.consentContact)}</span></label>${e.consent_contact ? `<p class="err" role="alert">${esc(K.errors.consent_contact)}</p>` : ''}
<label class="check"><input type="checkbox" name="consent_marketing"${v.consent_marketing ? ' checked' : ''}><span>${esc(K.consentMarketing)}</span></label>
${CFG.turnstileSiteKey ? '<div id="turnstile" class="turnstile"></div>' : ''}
<div class="bar"><button type="submit" class="btn btn--brass btn--block" data-submit>${esc(K.submit)}</button></div></form>`;
}

function resultScreen() {
  const R = C.result, r = state.result;
  const lv = R.levels[r.level];
  const zones = R.zones.map((z) => `<span>${esc(z)}</span>`).join('');
  const obstacle = r.obstacle && C.notes[r.obstacle];
  const task = r.tasks && r.tasks[0] && C.cards.c2.rows[r.tasks[0]] && C.cards.c2.rows[r.tasks[0]].short;
  const cta = r.cta, K = R.cta[cta];
  const formats = (r.wantedFormats || []).map((f) => R.formats[f]).filter(Boolean);
  let action = '';
  if (cta === 'call') action = `<a class="btn btn--brass btn--block" href="${esc(CFG.calendarUrl)}" target="_blank" rel="noopener" data-act="cta">${esc(K.button)}</a><p class="muted">${esc(K.text)}</p>`;
  else if (cta === 'review') action = `<button class="btn btn--brass btn--block" data-act="cta-review" aria-expanded="false" aria-controls="first-step">${esc(K.button)}</button><div id="first-step" class="first-step" hidden><p>${esc(K.text)}</p></div>`;
  else action = `${CFG.resourceUrl ? `<a class="btn btn--brass btn--block" href="${esc(CFG.resourceUrl)}" target="_blank" rel="noopener" data-act="cta">${esc(K.button)}</a>` : `<p class="ph">${esc(K.placeholder)}</p>`}${formats.length ? `<p class="muted">${esc(fmt(K.formats, { formats: formats.join(', ') }))}</p>` : ''}`;
  return `<div class="screen screen--result"><p class="kicker">${esc(R.kicker)}</p><h1 data-title tabindex="-1">${esc(R.title)}</h1>
<div class="scale"><svg viewBox="0 0 300 44" role="img" aria-label="${esc(fmt(R.scaleLabel, { n: r.readiness, level: lv.label }))}"><rect x="0" y="14" width="120" height="14" rx="7" class="z1"/><rect x="122" y="14" width="88" height="14" rx="7" class="z2"/><rect x="212" y="14" width="88" height="14" rx="7" class="z3"/><g class="marker" style="transform:translateX(${reduceMotion ? r.readiness * 3 : 0}px)" data-target="${r.readiness * 3}"><circle cx="0" cy="21" r="10"/><text x="0" y="25" text-anchor="middle">${r.readiness}</text></g></svg><div class="scale__zones" aria-hidden="true">${zones}</div></div>
<h2 class="level">${esc(lv.label)}</h2><p class="lead">${esc(lv.text)}</p><p class="muted small">${esc(R.disclaimer)}</p>
<ul class="notes">${obstacle ? `<li>${esc(obstacle)}</li>` : ''}${task ? `<li>${esc(task)}</li>` : ''}${r.highIndexAffordableStep ? `<li class="notes__hi">${esc(R.highIndexNote)}</li>` : ''}</ul>
<div class="action">${action}</div>${state.email ? `<p class="muted small">${esc(fmt(R.copySent, { email: state.email }))}</p>` : ''}</div>`;
}

function thanks() {
  const T = C.thanks;
  return `<div class="screen"><h1 data-title tabindex="-1">${esc(T.title)}</h1><p class="lead">${esc(T.text)}</p><p class="ph">${esc(T.resource)}</p><button class="btn btn--ghost" data-act="restart">${esc(T.restart)}</button></div>`;
}

function render() {
  const k = state.key;
  if (CFG.mode === 'result') root.innerHTML = state.result ? resultScreen() : `<div class="screen"><p class="err">${esc(C.result.invalid)}</p></div>`;
  else if (k === 'welcome') root.innerHTML = welcome();
  else if (k === 'thanks') root.innerHTML = thanks();
  else if (k === 'result') root.innerHTML = state.result ? resultScreen() : '';
  else {
    const step = stepList().find((s) => s.key === k);
    if (!step) { root.innerHTML = ''; return go('stage', { push: false }); }
    root.innerHTML = step.card ? card(k) : step.contact ? contactScreen() : questionsScreen(step);
  }
  bind();
  autosize();
  const m = $('.marker'); if (m && !reduceMotion) requestAnimationFrame(() => requestAnimationFrame(() => { m.style.transform = `translateX(${m.dataset.target}px)`; }));
  if (state.focusId) { const el = document.getElementById(state.focusId); if (el) el.focus(); state.focusId = null; }
}

// ── Interaction ──────────────────────────────────────────────────────
function autosize() { root.querySelectorAll('textarea').forEach((t) => { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 320) + 'px'; updateCounter(t); }); }
function updateCounter(t) {
  const box = t.closest('.q'); const c = box && $('.counter', box); if (!c) return;
  const n = t.value.trim().length, min = Number(c.dataset.min || 0);
  c.textContent = min && n < min ? fmt(C.ui.minChars, { n: min }) + ` · ${n}` : fmt(C.ui.counter, { n });
}
function refreshNext() { const b = $('[data-act=next]'); const step = stepList().find((s) => s.key === state.key); if (b && step) b.disabled = !screenValid(step); }

async function advance() {
  const step = stepList().find((s) => s.key === state.key);
  if (!step) return;
  for (const q of screenQs(step)) { const v = state.answers[q]; if (v === undefined || (Array.isArray(v) && !v.length) || (v === '' && !state.saved[q])) continue; if (!(await save(q))) { state.errors.save = C.ui.saveError; render(); return; } }
  if (state.key === 'work' && state.answers.stage === 'browsing') return go('thanks');
  go(nextKey(state.key));
}

function bind() {
  root.onclick = async (e) => {
    const chip = e.target.closest('[data-chip]');
    if (chip) { const ta = $('textarea', chip.closest('.q')); const q = ta.dataset.text; const add = chip.dataset.chip; const cur = ta.value.trim(); ta.value = cur ? (cur.includes(add) ? cur : `${cur}, ${add}`) : add; localSet(q, ta.value); autosize(); refreshNext(); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'start') return startSession();
    if (act === 'resume') return go(state.resumeKey);
    if (act === 'restart') return startSession(true);
    if (act === 'back') { track('step_back', state.key); return history.length > 1 ? history.back() : go('stage'); }
    if (act === 'cont') return go(nextKey(state.key));
    if (act === 'next' || act === 'skip') { if (act === 'skip') { for (const q of screenQs(stepList().find((s) => s.key === state.key))) if (!QUESTIONS[q].required) delete state.answers[q]; } return advance(); }
    if (act === 'cta' ) track('cta_click', 'result');
    if (act === 'cta-review') { const p = $('#first-step'); p.hidden = !p.hidden; b.setAttribute('aria-expanded', String(!p.hidden)); track('cta_click', 'result'); }
  };

  root.onchange = (e) => {
    const t = e.target; if (!t.name || !QUESTIONS[t.name]) return handleContactChange(t);
    const q = t.name, Q = QUESTIONS[q];
    state.focusId = t.id;
    if (Q.type === 'single') {
      localSet(q, t.value);
      const step = stepList().find((s) => s.key === state.key);
      const auto = step.questions.length === 1 && step.key !== 'a4';
      save(q).then((ok) => {
        if (!ok) { state.errors.save = C.ui.saveError; return render(); }
        if (!auto) return render();
        render();
        state.timer = setTimeout(() => { if (state.key === step.key) { if (q === 'work' && state.answers.stage === 'browsing') return go('thanks'); go(nextKey(step.key)); } }, reduceMotion ? 0 : 300);
      });
      return;
    }
    if (Q.type === 'multi') {
      let cur = [...root.querySelectorAll(`input[name="${q}"]:checked`)].map((i) => i.value);
      if (Q.exclusive && t.value === Q.exclusive && t.checked) cur = [Q.exclusive];
      else if (Q.exclusive) cur = cur.filter((v) => v !== Q.exclusive);
      localSet(q, cur); render();
    }
  };

  root.oninput = (e) => {
    const t = e.target;
    if (t.matches('[data-text]')) { localSet(t.dataset.text, t.value); autosize(); refreshNext(); }
    else if (t.closest('[data-form=contact]')) handleContactChange(t);
  };

  const form = $('[data-form=contact]');
  if (form) { form.onsubmit = submit; mountTurnstile(); }
}

function handleContactChange(t) {
  if (!t.closest('[data-form=contact]') || !t.name) return;
  state.contact[t.name] = t.type === 'checkbox' ? t.checked : t.value;
  store.set('tf_contact', JSON.stringify(state.contact)); // never lose typed contact details
  if (t.name === 'phone') { const ch = $('[data-channel]'); if (ch) ch.hidden = !t.value.trim(); }
}

// ── Session ──────────────────────────────────────────────────────────
function utm() { const p = new URLSearchParams(location.search); return Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].filter((k) => p.get(k)).map((k) => [k, p.get(k)])); }
async function startSession(restart = false) {
  const r = await api('POST', '/session', { locale: CFG.lang, deviceClass: matchMedia('(max-width: 820px)').matches ? 'mobile' : 'desktop', utm: utm(), src: new URLSearchParams(location.search).get('src'), referrer: document.referrer, restart });
  if (!r.ok) { state.banner = C.contact.errors.generic; return render(); }
  state.answers = r.data.answers || {}; state.saved = { ...state.answers };
  const answered = Object.keys(state.answers).length > 0;
  if (r.data.resumed && answered && !restart) {
    const l = steps(state.answers).map((s) => s.key); const last = l.indexOf(r.data.stepKey);
    state.resume = true; state.resumeKey = l[Math.min(last + 1, l.length - 1)] || 'stage';
    return render();
  }
  state.resume = false; store.set('tf_started', '1'); go('stage');
}

// ── Contact + submit ─────────────────────────────────────────────────
let tsToken = '';
function mountTurnstile() {
  if (!CFG.turnstileSiteKey) return;
  const draw = () => { const el = $('#turnstile'); if (el && window.turnstile) window.turnstile.render(el, { sitekey: CFG.turnstileSiteKey, callback: (t) => { tsToken = t; }, 'expired-callback': () => { tsToken = ''; } }); };
  if (window.turnstile) return draw();
  if (!$('script[data-ts]')) { const sc = document.createElement('script'); sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; sc.async = true; sc.dataset.ts = '1'; sc.onload = draw; document.head.appendChild(sc); }
}

async function submit(e) {
  e.preventDefault();
  const K = C.contact, c = state.contact;
  const contact = { name: c.name, email: c.email, phone: c.phone, channel: c.channel, link: c.link, consent_contact: !!c.consent_contact, consent_marketing: !!c.consent_marketing };
  const v = validateContact(contact);
  if (!v.ok) { state.errors = v.errors; state.banner = ''; render(); const first = $('[role=alert]'); if (first) first.scrollIntoView({ block: 'center' }); return; }
  const btn = $('[data-submit]'); btn.disabled = true; btn.textContent = K.submitting;
  const r = await api('POST', '/submit', { contact: v.value, turnstileToken: tsToken, website: new FormData(e.target).get('website') || '' });
  if (r.ok) {
    state.result = r.data.result; state.email = r.data.email; state.errors = {};
    ['tf_contact'].forEach((k) => store.set(k, '{}'));
    return go('result');
  }
  const d = r.data || {};
  if (r.status === 422 && d.error === 'incomplete') {
    const target = stepList().find((s) => (s.questions || []).some((q) => d.missing.includes(q)));
    if (target) return go(target.key);
  }
  state.errors = d.error === 'contact' && d.fields ? d.fields : {};
  state.banner = d.error === 'captcha' ? K.errors.captcha : d.error === 'rate_limited' ? K.errors.rate_limited : d.error === 'contact' ? '' : K.errors.generic;
  render();
}

// ── Boot ─────────────────────────────────────────────────────────────
(async function boot() {
  if (CFG.mode === 'result') {
    const t = new URLSearchParams(location.search).get('t');
    if (t) { const r = await api('GET', '/result/' + encodeURIComponent(t)); if (r.ok) { state.result = r.data.result; state.email = r.data.email; } }
    return render();
  }
  history.replaceState({ k: 'welcome' }, '', location.href);
  if (store.get('tf_started')) {
    const r = await api('POST', '/session', { peek: true });
    if (r.ok && r.data.resumed && Object.keys(r.data.answers || {}).length) {
      state.answers = r.data.answers; state.saved = { ...r.data.answers };
      const l = steps(state.answers).map((s) => s.key); const last = l.indexOf(r.data.stepKey);
      state.resume = true; state.resumeKey = l[Math.min(last + 1, l.length - 1)] || 'stage';
    }
  }
  render();
})();

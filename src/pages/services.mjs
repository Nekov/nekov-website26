import { CALENDLY, esc, t } from '../layout.mjs';
import { contact, models } from './home.mjs';

function pillarBlock(s, p, n) {
  const L = s.labels;
  return `<section class="band band--ivory" id="${p.id}" aria-labelledby="${p.id}-h">
  <div class="wrap svc">
    <div>
      <span class="num">0${n + 1}</span>
      <h2 id="${p.id}-h">${esc(p.title)}</h2>
      <p class="price">${esc(s.onRequest)}</p>
      <a class="btn btn--forest" href="#contact">${esc(s.cta)}</a>
    </div>
    <dl class="svc__facts">
      <div><dt>${esc(L.who)}</dt><dd>${esc(p.who)}</dd></div>
      <div><dt>${esc(L.included)}</dt><dd><ul class="ticks">${p.included.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></dd></div>
      <div><dt>${esc(L.gets)}</dt><dd>${esc(p.gets)}</dd></div>
      <div><dt>${esc(L.timeline)}</dt><dd>${t(p.timeline)}</dd></div>
      ${p.example ? `<div><dt>${esc(L.example)}</dt><dd>${esc(p.example)}</dd></div>` : ''}
    </dl>
  </div>
</section>`;
}

function session(c, stripeConfigured) {
  const s = c.services.session, m = c.models.session, q = s.q;
  return `<section class="band band--ivory" id="session" aria-labelledby="session-h">
  <div class="wrap session-block">
    <div>
      <p class="label">${esc(s.label)}</p>
      <h2 id="session-h">${esc(s.h2)} <span class="session__price">${esc(s.price)}</span></h2>
      <p class="lead muted">${esc(m.text)}</p>
      <p class="muted">${esc(s.intro)}</p>
    </div>
    <form class="form form--ivory" action="/api/contact" method="post">
      <input type="hidden" name="intent" value="session">
      <input type="hidden" name="topic" value="Стратегическа сесия">
      <input type="hidden" name="language" value="bg">
      <input type="hidden" name="source" value="/services/">
      <p class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></p>
      <label for="ss-name">${esc(c.contact.fields.name)}</label>
      <input id="ss-name" name="name" type="text" autocomplete="name" required>
      <label for="ss-email">${esc(c.contact.fields.email)}</label>
      <input id="ss-email" name="email" type="email" autocomplete="email" required>
      <label for="ss-business">${esc(q.business)}</label>
      <textarea id="ss-business" name="intake_business" rows="2" required></textarea>
      <label for="ss-goal">${esc(q.goal)}</label>
      <textarea id="ss-goal" name="intake_goal" rows="2" required></textarea>
      <label for="ss-stage">${esc(q.stage)}</label>
      <input id="ss-stage" name="intake_stage" type="text" required>
      <label class="consent"><input type="checkbox" name="consent" required> <span>${esc(c.contact.consentPre)}<a href="/privacy/">${esc(c.contact.consentLink)}</a></span></label>
      <button class="btn btn--forest" type="submit">${esc(s.submit)}</button>
      ${stripeConfigured ? '' : `<p class="small">${t(s.noLink)}</p>`}
    </form>
  </div>
</section>`;
}

export function services(c, { stripeConfigured }) {
  const s = c.services;
  return `<section class="band band--forest hero" aria-labelledby="svc-h1">
  <div class="wrap">
    <p class="label">${esc(s.label)}</p>
    <h1 id="svc-h1">${esc(s.h1)}</h1>
    <p class="lead narrow">${esc(c.pillars.lead)}</p>
  </div>
</section>
${s.pillars.map((p, n) => pillarBlock(s, p, n)).join('\n')}
${models(c, false)}
${session(c, stripeConfigured)}
<section class="band band--ivory" id="team" aria-labelledby="team-h">
  <div class="wrap">
    <p class="label">${esc(s.team.label)}</p>
    <h2 id="team-h">${esc(s.team.h2)}</h2>
    <p class="lead narrow">${esc(s.team.text)}</p>
    <p class="muted small">${t(s.team.confirm)}</p>
  </div>
</section>
${contact(c, '/services/')}`;
}

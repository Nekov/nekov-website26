import { CALENDLY, esc, t } from '../layout.mjs';
import { formTarget } from '../forms.mjs';

// Feature flags. The availability card stays off until Nikolay confirms it is true.
const FLAGS = { availabilityCard: false };

const list = (items, cls = '') => `<ul class="${cls}">${items.map((i) => `<li>${t(i)}</li>`).join('')}</ul>`;

function hero(c, img) {
  const h = c.hero;
  return `<section class="band band--forest hero" id="top">
  <div class="wrap hero__grid">
    <div>
      <p class="label">${esc(h.label)}</p>
      <h1>${esc(h.h1)}</h1>
      <p class="lead">${esc(h.lead)}</p>
      <div class="hero__actions">
        <a class="btn btn--brass" href="${CALENDLY}" target="_blank" rel="noopener">${esc(h.primary)}</a>
        <a class="btn btn--outline" href="#models">${esc(h.secondary)}</a>
      </div>
      <p class="hero__proof">${esc(h.proof)}</p>
    </div>
    ${img('nikolay-hero', { alt: h.imgAlt, sizes: '(max-width: 860px) 100vw, 40vw', eager: true })}
  </div>
</section>`;
}

const recognition = (c) => `<section class="band band--ivory band--tight" aria-labelledby="recognition">
  <div class="wrap">
    <h2 class="sr" id="recognition">${esc(c.recognition.label)}</h2>
    <p class="label" aria-hidden="true">${esc(c.recognition.label)}</p>
    <ul class="recog">${c.recognition.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
    <p class="muted small">${esc(c.recognition.press)}</p>
  </div>
</section>`;

function pillars(c) {
  const p = c.pillars;
  return `<section class="band band--ivory" id="services" aria-labelledby="pillars-h">
  <div class="wrap">
    <p class="label">${esc(p.label)}</p>
    <h2 id="pillars-h" class="narrow">${esc(p.h2)}</h2>
    <p class="lead muted narrow">${esc(p.lead)}</p>
    <div class="grid grid--2">
${p.items.map((i, n) => `      <article class="card pillar">
        <span class="num">0${n + 1}</span>
        <h3>${esc(i.title)}</h3>
        <p>${esc(i.text)}</p>
        <p class="result"><strong>${esc(p.resultLabel)}:</strong> ${esc(i.result)}${i.example ? ` <span class="muted">${esc(p.exampleLabel)}: ${esc(i.example)}.</span>` : ''}</p>
      </article>`).join('\n')}
    </div>
  </div>
</section>`;
}

function ecosystem(c, img) {
  const e = c.ecosystem;
  return `<section class="band band--forest" id="proof" aria-labelledby="eco-h">
  <div class="wrap">
    <p class="label">${esc(e.label)}</p>
    <h2 id="eco-h" class="narrow">${esc(e.h2)}</h2>
    <p class="lead narrow">${esc(e.lead)}</p>
    <div class="eco">
      <article class="card card--inset">
        <h3>${esc(e.karavani.name)}</h3>
        <p class="meta">${t(e.karavani.meta)}</p>
        <p>${esc(e.karavani.text)}</p>
        ${list(e.karavani.bullets, 'ticks')}
      </article>
      <span class="eco__arrow" aria-hidden="true">→</span>
      <article class="card">
        <h3>${esc(e.nextribe.name)}</h3>
        <p class="meta meta--ivory">${esc(e.nextribe.meta)}</p>
        <p>${esc(e.nextribe.text)}</p>
        ${list(e.nextribe.bullets, 'ticks')}
      </article>
    </div>
    <div class="band-photo" role="img" aria-label="${esc(e.photo)}"><span>${t(e.photo)}</span></div>
  </div>
</section>`;
}

function cases(c, img) {
  const k = c.cases, j = k.jaya, u = k.utopia;
  return `<section class="band band--ivory" id="cases" aria-labelledby="cases-h">
  <div class="wrap">
    <p class="label">${esc(k.label)}</p>
    <h2 id="cases-h" class="narrow">${esc(k.h2)}</h2>
    <div class="grid grid--2">
      <article class="card case">
        ${img('jaya-website', { alt: j.alt, sizes: '(max-width: 860px) 100vw, 560px' })}
        <p class="tag">${esc(j.tag)}</p>
        <h3>${esc(j.name)}</h3>
        <p><strong>${esc(k.challengeLabel)}:</strong> ${esc(j.challenge)}</p>
        <p><strong>${esc(k.builtLabel)}:</strong> ${esc(j.built)}</p>
        <p class="stat-row">${j.results.map((r) => `<span>${esc(r)}</span>`).join('')}</p>
      </article>
      <article class="card case">
        <div class="case__ph" aria-hidden="true"></div>
        <p class="tag">${esc(u.tag)}</p>
        <h3>${esc(u.name)}</h3>
        <p><strong>${esc(k.challengeLabel)}:</strong> ${esc(u.challenge)}</p>
        <p><strong>${esc(k.builtLabel)}:</strong> ${esc(u.built)}</p>
        <p class="stat-row"><span>${t(u.result)}</span></p>
      </article>
    </div>
  </div>
</section>`;
}

export function models(c, withSession = true) {
  const m = c.models;
  return `<section class="band band--ivory" id="models" aria-labelledby="models-h">
  <div class="wrap">
    <p class="label">${esc(m.label)}</p>
    <h2 id="models-h" class="narrow">${esc(m.h2)}</h2>
    <div class="grid grid--2">
      <article class="card model">
        <h3>${esc(m.project.name)}</h3>
        <p>${esc(m.project.text)}</p>
        <p class="meta meta--ivory">${t(m.project.term)}</p>
        <p class="price">${esc(m.onRequest)}</p>
        <a class="btn btn--forest" href="#contact">${esc(m.project.cta)}</a>
      </article>
      <article class="card model model--dark">
        <h3>${esc(m.partner.name)}</h3>
        <p>${esc(m.partner.text)}</p>
        <p class="price">${esc(m.onRequest)}</p>
        <a class="btn btn--brass" href="#contact">${esc(m.partner.cta)}</a>
      </article>
    </div>
    ${withSession ? `<div class="session">
      <div><h3>${esc(m.session.name)}</h3><p>${esc(m.session.text)}</p></div>
      <p class="session__price">${esc(m.session.price)}</p>
    </div>` : ''}
  </div>
</section>`;
}

function process(c) {
  const p = c.process, tm = p.team;
  return `<section class="band band--ivory" id="process" aria-labelledby="process-h">
  <div class="wrap">
    <p class="label">${esc(p.label)}</p>
    <h2 id="process-h" class="narrow">${esc(p.h2)}</h2>
    <ol class="steps">
${p.steps.map(([h, x], n) => `      <li><span class="num">0${n + 1}</span><h3>${esc(h)}</h3><p>${t(x)}</p></li>`).join('\n')}
    </ol>
    <div class="team card">
      <h3>${esc(tm.title)}</h3>
      <p>${esc(tm.text)}</p>
      <ul class="chips">${tm.chips.map((x) => `<li>${esc(x)}</li>`).join('')}${tm.placeholders.map((x) => `<li class="chip--ph">${t(x)}</li>`).join('')}</ul>
    </div>
  </div>
</section>`;
}

function asia(c) {
  const a = c.asia;
  return `<section class="band band--forest" id="global" aria-labelledby="asia-h">
  <div class="wrap">
    <p class="label">${esc(a.label)}</p>
    <h2 id="asia-h" class="narrow">${esc(a.h2)}</h2>
    <p class="lead narrow">${esc(a.text)}</p>
    <ul class="countries">
${a.cards.map(([n, d]) => `      <li class="card card--inset"><h3>${esc(n)}</h3>${d ? `<p>${esc(d)}</p>` : ''}<p class="ph-line">${t(a.learned)}</p></li>`).join('\n')}
    </ul>
  </div>
</section>`;
}

function testimonials(c) {
  const x = c.testimonials, [first, ...rest] = x.items;
  const cite = (i) => `<footer><strong>${esc(i.who)}</strong>, ${esc(i.role)}</footer>`;
  return `<section class="band band--ivory" id="reviews" aria-labelledby="rev-h">
  <div class="wrap">
    <h2 class="sr" id="rev-h">${esc(x.label)}</h2>
    <p class="label" aria-hidden="true">${esc(x.label)}</p>
    <figure class="quote quote--lead"><blockquote><p>${esc(first.q)}</p></blockquote>${cite(first).replace('footer', 'figcaption')}</figure>
    <div class="grid grid--2">
${rest.map((i) => `      <figure class="card quote"><blockquote><p>${esc(i.q)}</p></blockquote>${cite(i).replace(/footer/g, 'figcaption')}</figure>`).join('\n')}
    </div>
    <p class="dashed">${t(x.more)}</p>
  </div>
</section>`;
}

function about(c, img) {
  const a = c.about;
  return `<section class="band band--forest" id="about" aria-labelledby="about-h">
  <div class="wrap about">
    ${img('nikolay-about', { alt: a.imgAlt, sizes: '(max-width: 860px) 100vw, 400px' })}
    <div>
      <p class="label">${esc(a.label)}</p>
      <h2 id="about-h">${esc(a.h2)}</h2>
      <p class="lead">${esc(a.text)}</p>
      <dl class="stats">${a.stats.map(([n, l]) => `<div><dt>${esc(n)}</dt><dd>${esc(l)}</dd></div>`).join('')}</dl>
      <p class="orgs">${esc(a.orgs)}</p>
    </div>
  </div>
</section>`;
}

function media(c, img) {
  const m = c.media, tr = m.trainings;
  return `<section class="band band--ivory" id="media" aria-labelledby="media-h">
  <div class="wrap">
    <p class="label">${esc(m.label)}</p>
    <h2 id="media-h" class="narrow">${esc(m.h2)}</h2>
    <div class="grid grid--3">
${m.cards.map((x) => `      <article class="card"><h3>${t(x)}</h3><p>${t(m.cardMeta)}</p></article>`).join('\n')}
    </div>
    <div class="trainings">
      <div class="trainings__text">
        <h3>${esc(tr.title)}</h3>
        <p>${esc(tr.text)}</p>
        <a class="btn btn--forest" href="/trainings/">${esc(tr.cta)}</a>
      </div>
      ${img('nekov-speaking-4', { alt: tr.alt1, sizes: '(max-width: 860px) 45vw, 220px' })}
      ${img('nekov-speaking-5', { alt: tr.alt2, sizes: '(max-width: 860px) 45vw, 360px' })}
    </div>
  </div>
</section>`;
}

const faq = (c) => `<section class="band band--ivory" id="faq" aria-labelledby="faq-h">
  <div class="wrap faq">
    <h2 id="faq-h">${esc(c.faq.h2)}</h2>
${c.faq.items.map(([q, a]) => `    <details><summary>${esc(q)}</summary><p>${t(a)}</p></details>`).join('\n')}
  </div>
</section>`;

export function contact(c, source = '/') {
  const k = c.contact, f = k.fields;
  const target = formTarget({ subject: 'Нова заявка от nekov.com' });
  return `<section class="band band--forest" id="contact" aria-labelledby="contact-h">
  <div class="wrap contact">
    <div>
      <p class="label">${esc(k.label)}</p>
      <h2 id="contact-h">${esc(k.h2)}</h2>
      <p class="lead">${esc(k.text)}</p>
      <ul class="ticks">${k.ticks.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    </div>
    <form class="form" action="${target.action}" method="post">
      <input type="hidden" name="language" value="bg">
      <input type="hidden" name="source" value="${source}">
      ${target.fields}
      <label for="cf-name">${esc(f.name)}</label>
      <input id="cf-name" name="name" type="text" autocomplete="name" required>
      <label for="cf-email">${esc(f.email)}</label>
      <input id="cf-email" name="email" type="email" autocomplete="email" required>
      <label for="cf-topic">${esc(f.topic)}</label>
      <select id="cf-topic" name="topic" required>${k.topics.map((x) => `<option>${esc(x)}</option>`).join('')}</select>
      <label for="cf-message">${esc(f.message)}</label>
      <textarea id="cf-message" name="message" rows="4"></textarea>
      <label class="consent"><input type="checkbox" name="consent" required> <span>${esc(k.consentPre)}<a href="/privacy/">${esc(k.consentLink)}</a></span></label>
      <button class="btn btn--brass" type="submit">${esc(k.submit)}</button>
      <a class="btn btn--outline" href="${CALENDLY}" target="_blank" rel="noopener">${esc(k.calendar)}</a>
    </form>
  </div>
</section>`;
}

export function home(c, img) {
  const availability = FLAGS.availabilityCard ? '' : '';
  return [hero(c, img), availability, recognition(c), pillars(c), ecosystem(c, img), cases(c, img), models(c), process(c), asia(c), testimonials(c), about(c, img), media(c, img), faq(c), contact(c)]
    .filter(Boolean).join('\n');
}

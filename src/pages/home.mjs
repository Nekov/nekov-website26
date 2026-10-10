import { CALENDLY, esc } from '../layout.mjs';

// Phase 1: hero only, to prove tokens, fonts and the hero portrait on forest green.
// Phase 2 adds the remaining fourteen blocks from the brief.
export function home(c) {
  const h = c.hero;
  return `<section class="band band--forest hero">
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
    <img class="photo" src="/images/nikolay-hero.jpeg" width="1600" height="1200" alt="${esc(h.imgAlt)}" fetchpriority="high">
  </div>
</section>`;
}

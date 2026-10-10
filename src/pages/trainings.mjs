import { CALENDLY, esc } from '../layout.mjs';

export function trainings(c, img) {
  const k = c.trainings;
  return `<section class="band band--forest hero" aria-labelledby="tr-h1">
  <div class="wrap">
    <p class="label">${esc(k.label)}</p>
    <h1 id="tr-h1">${esc(k.h1)}</h1>
    <p class="lead narrow">${esc(k.lead)}</p>
  </div>
</section>
<section class="band band--ivory" id="past-events" aria-labelledby="past-h">
  <div class="wrap events">
    <div>
      <p class="label">${esc(k.listLabel)}</p>
      <h2 id="past-h">${esc(k.h2)}</h2>
      <ul class="event-list">
${k.events.map(([title, date, place]) => `        <li class="card"><p class="event__title">${esc(title)}</p><p class="event__meta">${esc(date)}${place ? ` · ${esc(place)}` : ''}</p></li>`).join('\n')}
      </ul>
    </div>
    ${img('nekov-speaking-4', { alt: k.photoAlt, sizes: '(max-width: 860px) 100vw, 360px' })}
  </div>
</section>
<section class="band band--forest" aria-labelledby="tr-cta">
  <div class="wrap cta">
    <h2 id="tr-cta">${esc(k.ctaText)}</h2>
    <a class="btn btn--brass" href="${CALENDLY}" target="_blank" rel="noopener">${esc(k.cta)}</a>
  </div>
</section>`;
}

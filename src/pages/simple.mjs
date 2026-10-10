import { esc, t } from '../layout.mjs';

export const privacy = (c) => `<section class="band band--ivory" aria-labelledby="pv-h">
  <div class="wrap prose">
    <h1 id="pv-h">${esc(c.privacy.h1)}</h1>
    <p class="dashed">${t(c.privacy.body)}</p>
  </div>
</section>`;

export const sent = (c) => `<section class="band band--ivory" aria-labelledby="sent-h">
  <div class="wrap prose">
    <h1 id="sent-h">${esc(c.sent.h1)}</h1>
    <p class="lead">${esc(c.sent.text)}</p>
    <a class="btn btn--forest" href="/">${esc(c.sent.back)}</a>
  </div>
</section>`;

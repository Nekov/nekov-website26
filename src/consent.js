// Loaded only when ENABLE_TRACKING=true in production. Nothing from Google or Meta loads before consent.
(() => {
  const cfg = JSON.parse(document.getElementById('trk-config').textContent);
  const banner = document.getElementById('consent-banner');
  const KEY = 'consent';
  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const write = (v) => { try { localStorage.setItem(KEY, v); } catch {} };
  let loaded = false;

  function load() {
    if (loaded) return;
    loaded = true;
    if (cfg.ga4) {
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(cfg.ga4);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', cfg.ga4);
    }
    if (cfg.pixel) {
      !function (f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
        t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', cfg.pixel);
      window.fbq('track', 'PageView');
    }
  }

  const track = (name, params) => {
    if (!loaded) return;
    if (window.gtag) window.gtag('event', name, params);
    if (window.fbq) window.fbq('trackCustom', name, params);
  };

  const show = () => { banner.hidden = false; };
  const choose = (v) => { write(v); banner.hidden = true; if (v === 'granted') load(); };

  if (read() === 'granted') load(); else if (read() !== 'denied') show();
  banner.addEventListener('click', (e) => { const b = e.target.closest('[data-consent]'); if (b) choose(b.dataset.consent); });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-consent-open]')) { show(); return; }
    const a = e.target.closest('a');
    if (!a) return;
    const where = (a.closest('[id]') || {}).id || 'page';
    if (a.href.includes('calendly.com')) track('calendly_click', { location: where });
    else if (a.href.includes('buy.stripe.com')) track('stripe_click', { location: where });
    else if (a.classList.contains('btn')) track('cta_click', { location: where });
  });
  document.addEventListener('submit', (e) => {
    const f = e.target;
    track(f.querySelector('[name=intent][value=session]') ? 'stripe_click' : 'form_submit', { location: (f.closest('[id]') || {}).id || 'page' });
  });
})();

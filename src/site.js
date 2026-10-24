// Mobile menu. Everything else is plain HTML.
const toggle = document.querySelector('.nav__toggle');
const panel = document.getElementById('nav-panel');
if (toggle && panel) {
  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

// An explicit language choice is remembered and always honoured (see middleware).
document.querySelectorAll('.lang a[data-lang]').forEach((a) => {
  a.addEventListener('click', () => {
    document.cookie = 'lang=' + a.dataset.lang + '; path=/; max-age=31536000; samesite=lax';
  });
});

// The old homepage #past-events list now lives on /trainings/.
if (location.hash === '#past-events' && (location.pathname === '/' || location.pathname === '/en/')) {
  location.replace((location.pathname === '/en/' ? '/en' : '') + '/trainings/#past-events');
}

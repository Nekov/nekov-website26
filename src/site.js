// Mobile menu. Everything else is plain HTML.
const toggle = document.querySelector('.nav__toggle');
const panel = document.getElementById('nav-panel');
if (toggle && panel) {
  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

// The old homepage #past-events list now lives on /trainings/.
if (location.hash === '#past-events' && location.pathname === '/') location.replace('/trainings/#past-events');

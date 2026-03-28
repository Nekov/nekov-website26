/* ============================================================
   NEKOV.COM — Main JavaScript
   ============================================================ */

(function () {
  'use strict';

  // Mark body so CSS can enable fade-in animations
  document.body.classList.add('js-loaded');

  /* ----------------------------------------------------------
     NAV — scroll state
  ---------------------------------------------------------- */
  const nav = document.getElementById('nav');
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ----------------------------------------------------------
     NAV — mobile menu toggle
  ---------------------------------------------------------- */
  const toggle = document.getElementById('navToggle');
  const mobileMenu = document.getElementById('navMobile');
  if (toggle && mobileMenu) {
    toggle.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.toggle('open');
      toggle.classList.toggle('open', isOpen);
      toggle.setAttribute('aria-expanded', isOpen);
    });

    // Close on link click
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', false);
      });
    });
  }

  /* ----------------------------------------------------------
     FADE-IN — IntersectionObserver
  ---------------------------------------------------------- */
  const fadeEls = document.querySelectorAll('.fade-in');
  if (fadeEls.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    fadeEls.forEach(el => observer.observe(el));
  } else {
    // Fallback: show all immediately
    fadeEls.forEach(el => el.classList.add('visible'));
  }

  /* ----------------------------------------------------------
     FAQ ACCORDION
  ---------------------------------------------------------- */
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-question');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      // Close all
      faqItems.forEach(i => i.classList.remove('open'));
      // Open clicked if was closed
      if (!isOpen) item.classList.add('open');
    });
  });

  /* ----------------------------------------------------------
     SMOOTH SCROLL — for anchor links
  ---------------------------------------------------------- */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const id = this.getAttribute('href').slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        const offset = 72; // nav height
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  /* ----------------------------------------------------------
     WORKSHOP — sticky CTA visibility
     Hide when tickets section is visible
  ---------------------------------------------------------- */
  const stickyCta = document.querySelector('.sticky-cta');
  const ticketsSection = document.getElementById('tickets');
  if (stickyCta && ticketsSection && 'IntersectionObserver' in window) {
    const stickyObserver = new IntersectionObserver(
      ([entry]) => {
        // Hide sticky bar when tickets are in view
        stickyCta.style.opacity = entry.isIntersecting ? '0' : '1';
        stickyCta.style.pointerEvents = entry.isIntersecting ? 'none' : 'auto';
      },
      { threshold: 0.2 }
    );
    stickyObserver.observe(ticketsSection);
  }
  if (stickyCta) {
    stickyCta.style.transition = 'opacity 0.3s ease';
  }

})();

/* factor-pairs 2026-11-13: optional once-only motion. Adds .fp-on to each .fp-pair the first time it is
   visible, so its bars grow and diagram arrows draw. Content is fully rendered in HTML/CSS without this file.
   Nothing runs under prefers-reduced-motion or without IntersectionObserver (static page). */
(function () {
  'use strict';
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  if (mq.matches || !('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('fp-on'); io.unobserve(e.target); }
    });
  }, { threshold: 0.3 });
  [].forEach.call(document.querySelectorAll('.fp-pair'), function (p) { io.observe(p); });
})();

/* Vertical zero-based score BAR chart: positive bars' upper edge comes down to
   the final value, negative bars extend from zero downward, ending on their final
   (static, server-rendered) rectangle when the chart enters the
   viewport or its language tab becomes active. Values/labels never change.
   No JS => static final chart. Reduced motion => no animation, no replay. */
(function () {
  'use strict';
  var SEL = 'figure.ps-vert, [data-psv-anim]'; // score/IL-8 bar figures + IDO1/RUNX2/p16 plots
  var figs = Array.prototype.slice.call(document.querySelectorAll(SEL));
  if (!figs.length) return;
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(mq && mq.matches); }

  function play(fig) {
    if (reduced()) { fig.classList.remove('psv-armed', 'psv-play'); return; }
    fig.classList.remove('psv-play');
    void fig.offsetWidth; // restart CSS animation
    fig.classList.add('psv-play');
    fig.classList.remove('psv-armed');
    fig.dataset.psvPlayed = '1';
  }
  function arm(fig) {
    if (reduced()) return;
    fig.dataset.psvPlayed = '';
    fig.classList.remove('psv-play');
    fig.classList.add('psv-armed');
  }

  figs.forEach(function (fig) {
    var b = fig.querySelector('.psv-replay');
    if (b) {
      b.hidden = false;
      b.addEventListener('click', function () { play(fig); });
    }
  });

  // Scroll cue only when the plot really overflows its box (any width).
  function ovf() {
    figs.forEach(function (fig) {
      var sc = fig.querySelector('.psv-scroll');
      if (sc && sc.scrollWidth !== undefined) fig.classList[sc.scrollWidth > sc.clientWidth + 1 ? 'add' : 'remove']('psv-ovf');
    });
  }
  ovf();
  if (window.addEventListener) window.addEventListener('resize', ovf);
  // language tabs: re-measure once the newly shown edition has layout
  if (document.addEventListener) document.addEventListener('click', function () { setTimeout(ovf, 60); });

  if (!('IntersectionObserver' in window) || reduced()) return; // static final chart

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting && e.target.dataset.psvPlayed !== '1') play(e.target);
    });
  }, { threshold: 0.35 });

  figs.forEach(function (fig) { arm(fig); io.observe(fig); });

  // Re-arm a language edition's charts when its tab becomes active again.
  document.querySelectorAll('.edition').forEach(function (ed) {
    var was = ed.classList.contains('active');
    new MutationObserver(function () {
      var on = ed.classList.contains('active');
      if (on && !was) {
        ed.querySelectorAll(SEL).forEach(function (f) {
          arm(f); io.unobserve(f); io.observe(f);
        });
      }
      was = on;
    }).observe(ed, { attributes: true, attributeFilter: ['class'] });
  });

  if (mq && mq.addEventListener) {
    mq.addEventListener('change', function () {
      if (reduced()) figs.forEach(function (f) { f.classList.remove('psv-armed', 'psv-play'); });
    });
  }
})();

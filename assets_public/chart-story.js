/* chart-story 2026-11-13
   1) Timed explainer players (4 scenes x 5 s): play/pause/replay. Plays once when visible; stops on last scene.
      No JS or reduced motion => all scenes stay visible as a static list.
   2) Group-result arrow (wide-charts 2026-11-13): dashed, from the pre-culture SVF reference bar tip to the
      Ryuyokai bar tip (.focus) across the separator; labelled as two distinct samples. Measured from the existing
      server-rendered bar geometry (--b/--h). No values are computed or changed. */
(function () {
  'use strict';
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function activeEd(el) { var ed = el.closest('.edition'); return !ed || ed.classList.contains('active'); }

  /* ---- players ---- */
  var players = [].slice.call(document.querySelectorAll('[data-cs-player]')).map(function (p) {
    var scenes = [].slice.call(p.querySelectorAll('.cs-scene'));
    var ctl = p.querySelector('.cs-ctl'), bPlay = p.querySelector('[data-cs-play]'), bRe = p.querySelector('[data-cs-replay]');
    var bar = p.querySelector('.cs-prog i'), ms = +p.getAttribute('data-cs-ms') || 5000;
    var st = { i: 0, t: null, playing: false, started: false, t0: 0, raf: 0 };
    function show(i) {
      st.i = i;
      scenes.forEach(function (s, k) { s.classList.toggle('is-on', k === i); s.setAttribute('aria-hidden', k === i ? 'false' : 'true'); });
    }
    function label() { bPlay.textContent = st.playing ? bPlay.getAttribute('data-cs-lpause') : bPlay.getAttribute('data-cs-lplay'); bPlay.setAttribute('aria-pressed', String(!st.playing)); p.classList.toggle('cs-paused', !st.playing); }
    function tick() {
      if (!st.playing) return;
      var f = Math.min(1, (st.i + (performance.now() - st.t0) / ms) / scenes.length);
      if (bar) bar.style.width = (f * 100).toFixed(1) + '%';
      st.raf = requestAnimationFrame(tick);
    }
    function step() {
      if (st.i >= scenes.length - 1) { stop(); return; }
      show(st.i + 1); st.t0 = performance.now(); st.t = setTimeout(step, ms);
    }
    function play() {
      if (mq.matches) return;
      if (st.i >= scenes.length - 1 && st.started && !st.playing) show(0);
      st.playing = st.started = true; st.t0 = performance.now(); clearTimeout(st.t); st.t = setTimeout(step, ms);
      cancelAnimationFrame(st.raf); tick(); label();
    }
    function stop() { st.playing = false; clearTimeout(st.t); cancelAnimationFrame(st.raf); label(); }
    function enable() {
      if (mq.matches) { p.classList.remove('cs-js'); scenes.forEach(function (s) { s.removeAttribute('aria-hidden'); }); ctl.hidden = true; stop(); return; }
      p.classList.add('cs-js'); ctl.hidden = false; show(st.i); label();
    }
    bPlay.addEventListener('click', function () { st.playing ? stop() : play(); });
    bRe.addEventListener('click', function () { stop(); show(0); if (bar) bar.style.width = '0'; play(); });
    enable();
    return { el: p, play: play, stop: stop, enable: enable, st: st };
  });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var pl = players.filter(function (x) { return x.el === e.target; })[0]; if (!pl) return;
        if (e.isIntersecting && !pl.st.started && activeEd(pl.el)) pl.play();
        if (!e.isIntersecting && pl.st.playing) pl.stop();
      });
    }, { threshold: 0.5 });
    players.forEach(function (x) { io.observe(x.el); });
  }
  new MutationObserver(function () { players.forEach(function (x) { if (!activeEd(x.el)) x.stop(); }); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
  function onMq() { players.forEach(function (x) { x.enable(); }); draw(); }
  if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);

  /* ---- anchored arrows ----
     Group charts with a pre-culture SVF reference bar: thin dashed arrow from the SVF reference bar tip
     (.ps-reference-row, left of the separator) to the Ryuyokai bar tip (.focus). It compares two DISTINCT
     samples (label text comes from the page: .cs-arrlab); it is not a before/after change. Charts without a
     reference row fall back to the selected six-culture comparator (.ps-prow.cmp). Geometry is read from the
     server-rendered bars (--b/--h); for negative bars the value end is the lower edge. No values computed. */
  var NS = 'http://www.w3.org/2000/svg';
  function pct(el, v) { var x = parseFloat(getComputedStyle(el).getPropertyValue(v)); return isNaN(x) ? 0 : x / 100; }
  function endPoint(row, plotRect) {
    var tr = row.querySelector('.ps-ptrack'), b = row.querySelector('.ps-pbar');
    if (!tr || !b) return null;
    var r = tr.getBoundingClientRect(); if (!r.height) return null;
    var neg = b.classList.contains('neg');
    var y = neg ? r.bottom - pct(b, '--b') * r.height
                : r.bottom - (pct(b, '--b') + pct(b, '--h')) * r.height;
    var bw = b.getBoundingClientRect().width || 0;
    return { x: r.left + r.width / 2 - plotRect.left, y: y - plotRect.top, neg: neg, hw: bw / 2 };
  }
  function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }
  function draw() {
    [].slice.call(document.querySelectorAll('figure.cs-anch')).forEach(function (fig) {
      var plot = fig.querySelector('.psv-plot'); if (!plot) return;
      var old = plot.querySelector('.cs-arrow'); if (old) old.remove();
      var lab = plot.querySelector('.cs-arrlab'); if (lab) lab.classList.remove('is-on');
      var pr = plot.getBoundingClientRect(); if (!pr.width) return;
      var a = fig.querySelector('.ps-reference-row') || fig.querySelector('.ps-prow.cmp'), z = fig.querySelector('.ps-prow.focus');
      if (!a || !z) return;
      var p1 = endPoint(a, pr), p2 = endPoint(z, pr); if (!p1 || !p2) return;
      var s = el('svg', { 'class': 'cs-arrow', 'aria-hidden': 'true', viewBox: '0 0 ' + pr.width + ' ' + pr.height });
      // start just above the reference bar tip; end at the Ryuyokai bar tip (beside it when the bar is negative,
      // so the arrow never runs through the bar body). Curve rises over the cultured bars, then comes down.
      var x1 = p1.x, y1 = p1.y - 6, x2, y2, cx, cy;
      if (p2.neg) { x2 = p2.x + p2.hw + 5; y2 = p2.y; cx = x2 + 22; }
      else { x2 = p2.x; y2 = p2.y - 6; cx = x2; }
      cy = Math.min(y1, y2) - 4;
      var path = el('path', { 'class': 'cs-ap', d: 'M' + x1 + ' ' + y1 + 'Q' + cx + ' ' + cy + ' ' + x2 + ' ' + y2 });
      var ux = x2 - cx, uy = y2 - cy, len = Math.sqrt(ux * ux + uy * uy) || 1; ux /= len; uy /= len;
      var k = 9, w = 4.5;
      var head = el('path', { 'class': 'cs-ah', d: 'M' + (x2 - ux * k - uy * w) + ' ' + (y2 - uy * k + ux * w) + 'L' + x2 + ' ' + y2 + 'L' + (x2 - ux * k + uy * w) + ' ' + (y2 - uy * k - ux * w) });
      var dot = el('circle', { cx: x1, cy: y1 + 6, r: 3 });
      s.appendChild(path); s.appendChild(head); s.appendChild(dot);
      s.setAttribute('data-cs-from', a.getAttribute('data-ps-cond')); s.setAttribute('data-cs-to', z.getAttribute('data-ps-cond'));
      plot.appendChild(s);
      if (lab && a.classList.contains('ps-reference-row')) {
        // label sits above the curve at its midpoint (t = .5), clamped inside the plot box
        var mx = (x1 + 2 * cx + x2) / 4, my = (y1 + 2 * cy + y2) / 4;
        lab.classList.add('is-on');
        var lw = lab.offsetWidth, lh = lab.offsetHeight;
        lab.style.left = Math.max(0, Math.min(pr.width - lw, mx - lw / 2)) + 'px';
        lab.style.top = Math.max(0, my - lh - 6) + 'px';
      }
    });
  }
  var rt; function later() { clearTimeout(rt); rt = setTimeout(draw, 120); }
  window.addEventListener('resize', later);
  new MutationObserver(later).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
  if (document.readyState === 'complete') draw(); else window.addEventListener('load', draw);
  draw();
})();
/* optional SASP clip: pause when its disclosure is collapsed so nothing plays hidden */
(function () {
  document.querySelectorAll('details.cs-vid').forEach(function (d) {
    d.addEventListener('toggle', function () { if (!d.open) d.querySelectorAll('video').forEach(function (v) { v.pause(); }); });
  });
})();

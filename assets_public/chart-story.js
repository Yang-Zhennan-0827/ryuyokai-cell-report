/* chart-story 2026-11-13
   1) Timed explainer players (4 scenes x 5 s): play/pause/replay. Plays once when visible; stops on last scene.
      No JS or reduced motion => all scenes stay visible as a static list.
   2) Group-result arrow: drawn from the TOP of the selected comparator bar (.cmp) to the TOP of the
      Ryuyokai bar (.focus), measured from the existing server-rendered bar geometry (--b/--h). For negative
      bars the value end is the lower edge. No values are computed or changed. */
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

  /* ---- anchored arrows ---- */
  var NS = 'http://www.w3.org/2000/svg';
  function pct(el, v) { var x = parseFloat(getComputedStyle(el).getPropertyValue(v)); return isNaN(x) ? 0 : x / 100; }
  function endPoint(row, plotRect) {
    var tr = row.querySelector('.ps-ptrack'), b = row.querySelector('.ps-pbar');
    if (!tr || !b) return null;
    var r = tr.getBoundingClientRect(); if (!r.height) return null;
    var y = b.classList.contains('neg') ? r.bottom - pct(b, '--b') * r.height
                                         : r.bottom - (pct(b, '--b') + pct(b, '--h')) * r.height;
    return { x: r.left + r.width / 2 - plotRect.left, y: y - plotRect.top };
  }
  function draw() {
    [].slice.call(document.querySelectorAll('figure.cs-anch')).forEach(function (fig) {
      var plot = fig.querySelector('.psv-plot'); if (!plot) return;
      var old = plot.querySelector('.cs-arrow'); if (old) old.remove();
      var pr = plot.getBoundingClientRect(); if (!pr.width) return;
      var a = fig.querySelector('.ps-prow.cmp'), z = fig.querySelector('.ps-prow.focus');
      if (!a || !z) return;
      var p1 = endPoint(a, pr), p2 = endPoint(z, pr); if (!p1 || !p2) return;
      var s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'cs-arrow'); s.setAttribute('aria-hidden', 'true');
      s.setAttribute('viewBox', '0 0 ' + pr.width + ' ' + pr.height);
      var dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / len, uy = dy / len;
      var hx = p2.x - ux * 4, hy = p2.y - uy * 4, k = 11;
      var path = document.createElementNS(NS, 'path');
      path.setAttribute('d', 'M' + p1.x + ' ' + p1.y + 'L' + (hx - ux * k) + ' ' + (hy - uy * k));
      var head = document.createElementNS(NS, 'path'); head.setAttribute('class', 'cs-ah');
      head.setAttribute('d', 'M' + hx + ' ' + hy + 'L' + (hx - ux * k - uy * 6) + ' ' + (hy - uy * k + ux * 6) + 'L' + (hx - ux * k + uy * 6) + ' ' + (hy - uy * k - ux * 6) + 'Z');
      var dot = document.createElementNS(NS, 'circle'); dot.setAttribute('cx', p1.x); dot.setAttribute('cy', p1.y); dot.setAttribute('r', 4);
      s.appendChild(path); s.appendChild(head); s.appendChild(dot);
      s.setAttribute('data-cs-from', a.getAttribute('data-ps-cond')); s.setAttribute('data-cs-to', z.getAttribute('data-ps-cond'));
      plot.appendChild(s);
    });
  }
  var rt; function later() { clearTimeout(rt); rt = setTimeout(draw, 120); }
  window.addEventListener('resize', later);
  new MutationObserver(later).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
  if (document.readyState === 'complete') draw(); else window.addEventListener('load', draw);
  draw();
})();

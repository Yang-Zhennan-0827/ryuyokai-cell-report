/* Native, silent, fixed-camera animation. Pause state survives language switches. */
(function () {
  'use strict';
  var media = window.matchMedia('(prefers-reduced-motion: reduce)');
  var records = [];
  function update(record) {
    var current = record.element.closest('.edition');
    var active = !current || current.classList.contains('active');
    var running = active && record.visible && !document.hidden && !record.userPaused && !media.matches;
    var now = performance.now();
    if (record.running) record.elapsed += now - record.since;
    record.since = now;
    record.running = running;
    record.element.dataset.zcState = running ? 'playing' : 'paused';
    record.element.dataset.zcReduced = String(media.matches);
    record.button.textContent = record.userPaused || media.matches ? record.button.dataset.play : record.button.dataset.pause;
    record.button.setAttribute('aria-pressed', String(record.userPaused || media.matches));
    record.button.disabled = media.matches;
    record.restart.disabled = media.matches;
    var phase = record.elapsed % 20000;
    record.element.dataset.zcStage = media.matches ? '2' : phase < 3500 ? '0' : phase < 11000 ? '1' : '2';
  }
  document.querySelectorAll('[data-zc-scene]').forEach(function (element) {
    var record = {element:element, button:element.querySelector('[data-zc-toggle]'), restart:element.querySelector('[data-zc-restart]'), userPaused:false, visible:!('IntersectionObserver' in window), running:false, elapsed:0, since:performance.now()};
    records.push(record);
    record.button.addEventListener('click', function () {record.userPaused = !record.userPaused; update(record);});
    record.restart.addEventListener('click', function () {
      record.elapsed = 0; record.since = performance.now(); record.running = false; record.userPaused = false;
      element.getAnimations({subtree:true}).forEach(function (animation) {animation.currentTime = 0;});
      update(record);
    });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (entries) {
      record.visible = entries[0].isIntersecting; update(record);
    }, {threshold:0.08}).observe(element);
    update(record);
  });
  function refresh() { records.forEach(update); }
  new MutationObserver(refresh).observe(document.documentElement, {attributes:true, attributeFilter:['data-lang']});
  document.addEventListener('visibilitychange', refresh);
  if (media.addEventListener) media.addEventListener('change', refresh); else media.addListener(refresh);
  window.setInterval(refresh, 250);
})();

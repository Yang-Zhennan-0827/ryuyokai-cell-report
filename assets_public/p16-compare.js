/* p16 side-by-side chart (2026-11-13). Static HTML already shows the final bars and values (works with JS off).
   With JS: bars stay fixed; a labeled comparison marker runs once from the comparator bar top down to the 柳葉会 bar top
   when the chart first scrolls into view (cross-sectional, separate samples); Replay / Pause controls.
   No loop. prefers-reduced-motion: no animation, controls stay hidden. Values are checked against the source chart
   (same edition, same condition, same raw attribute); on any mismatch the static chart is left untouched. */
(function(){
 var mq=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
 var boxes=[].slice.call(document.querySelectorAll('[data-pm16]'));
 function matches(box){
  var src=document.getElementById(box.getAttribute('data-pm16-src'));if(!src)return false;
  return [].slice.call(box.querySelectorAll('.pm16-col')).every(function(c){
   var s=src.querySelector('.zs-col[data-zs-cond="'+c.getAttribute('data-pm16-cond')+'"]');
   return !!s&&s.getAttribute('data-zs-raw')===c.getAttribute('data-pm16-raw')});
 }
 function stop(box){box.classList.remove('pm16-run','pm16-paused')}
 boxes.forEach(function(box){
  if(!matches(box))return;
  var ctl=box.querySelector('.pm16-ctl'),replay=box.querySelector('.pm16-replay'),pause=box.querySelector('.pm16-pause');
  if(!ctl||!replay||!pause)return;
  function setPaused(p){box.classList.toggle('pm16-paused',p);pause.textContent=p?pause.getAttribute('data-l-resume'):pause.getAttribute('data-l-pause');pause.setAttribute('aria-pressed',String(p))}
  function play(){if(mq.matches)return;stop(box);void box.offsetWidth;box.classList.add('pm16-run');setPaused(false)}
  replay.addEventListener('click',play);
  pause.addEventListener('click',function(){if(!box.classList.contains('pm16-run')){play();return}setPaused(!box.classList.contains('pm16-paused'))});
  box._pm16={ctl:ctl,play:play};
  if(!mq.matches)ctl.hidden=false;
  if('IntersectionObserver' in window&&!mq.matches){
   var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){io.disconnect();play()}})},{threshold:0.5});
   io.observe(box.querySelector('.pm16-plot')||box);
  }
 });
 function onMq(){boxes.forEach(function(b){if(!b._pm16)return;if(mq.matches){stop(b);b._pm16.ctl.hidden=true}else b._pm16.ctl.hidden=false})}
 if(mq.addEventListener)mq.addEventListener('change',onMq);else if(mq.addListener)mq.addListener(onMq);
})();

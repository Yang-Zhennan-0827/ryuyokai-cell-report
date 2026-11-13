/* Synchronize readable HTML labels with the actual particle movie. */
(function(){
 'use strict';
 document.querySelectorAll('video[data-sasp-continuous]').forEach(function(video){
  var box=video.closest('.sc-continuous');
  var items=box.querySelectorAll('[data-sc-stage]');
  function sync(){
   var t=video.currentTime||0;
   var stage=t<2?0:t<5?1:t<6?2:3;
   items.forEach(function(item,i){item.classList.toggle('is-current',i===stage);if(i===stage)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current')});
  }
  video.addEventListener('timeupdate',sync);video.addEventListener('seeked',sync);video.addEventListener('loadedmetadata',sync);sync();
 });
})();

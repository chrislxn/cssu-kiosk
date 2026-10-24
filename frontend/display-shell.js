/* Shared 1920x1080 stage fitting. Independent of all event and clock data. */
(() => {
  'use strict';
  function fit() {
    document.documentElement.style.setProperty('--design-scale',Math.min(innerWidth/1920,innerHeight/1080));
  }
  fit();
  window.addEventListener('resize',fit);
})();

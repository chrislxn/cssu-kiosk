/* OPTIONAL HTTP/localhost cache, disabled by default in content.js.
   Bump CACHE on any file change before deploying an HTTP version.
   Local file:// playback needs no service worker, server, or browser cache. */
'use strict';
const CACHE = 'cssu-signage-shell-v9';
const FILES = ['./','./index.html','./styles.css','./time-signal.css','./display-shell.js','./time-signal-config.js','./content.js','./app.js','./time-signal.js','./update.js','./assets/world-clock.svg','./assets/code.svg','./assets/play.svg','./assets/build.svg','./assets/cssu-icon.webp','./assets/cssu-logo.webp',...['coffee','cola','energy','bolt','chips','chocolate','icecream','gum','mini-chocolate','snack'].map(name => `./assets/products/${name}.svg`)];
self.addEventListener('install',event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))); });
self.addEventListener('activate',event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('cssu-signage-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch',event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./',self.location).pathname)) return;
  // Version checks must reach the server, never the offline shell cache.
  if (url.pathname === new URL('./version.txt',self.location).pathname || event.request.cache === 'no-store') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});

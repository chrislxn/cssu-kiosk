/* Automatic reload on version changes. Served beside index.html over HTTP(S).
   Publish all changed files first, then change version.txt LAST.
   file:// stays fully offline and does not attempt HTTP-only update checks. */
(() => {
  'use strict';
  if (!/^https?:$/.test(location.protocol)) return;

  let currentVersion = null;
  let checking = false;
  let reloading = false;
  const versionURL = new URL('./version.txt', document.baseURI);

  async function checkUpdate() {
    if (checking || reloading) return;
    checking = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(versionURL, {
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok) return;
      const version = (await response.text()).trim();
      if (!version) return;

      if (currentVersion !== null && version !== currentVersion) {
        reloading = true;
        // If optional shell caching was enabled, do not reload an old cached page.
        // Only this display's caches are removed; other apps' caches are untouched.
        if ('caches' in window) {
          try {
            const keys = await caches.keys();
            await Promise.all(keys.filter(key => key.startsWith('cssu-signage-shell-')).map(key => caches.delete(key)));
          } catch (error) {
            console.warn('Display cache refresh failed:', error);
          }
        }
        location.reload();
        return;
      }
      currentVersion = version;
    } catch (error) {
      // A disconnected server must not interrupt the running display.
      console.warn('Update check failed:', error);
    } finally {
      clearTimeout(timeout);
      checking = false;
    }
  }

  checkUpdate();
  setInterval(checkUpdate, 10000);
})();

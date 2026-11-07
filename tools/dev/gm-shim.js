// Stand-ins for the Violentmonkey APIs so the userscript can run on local snapshot pages.
// Loaded only by tools/dev-server.ps1, never on the real site.
(function () {
  'use strict';
  window.GM_info = { script: { version: 'dev' } };
  window.GM_getValue = function (key, fallback) {
    const raw = localStorage.getItem('gm.' + key);
    return raw === null ? fallback : JSON.parse(raw);
  };
  window.GM_setValue = function (key, value) {
    localStorage.setItem('gm.' + key, JSON.stringify(value));
  };

  // Snapshot links point at the live site. Keep every click local.
  document.addEventListener('click', function (e) {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const url = new URL(a.getAttribute('href'), location.href);
    if (url.origin !== location.origin) {
      e.preventDefault();
      console.info('[dev] blocked navigation to', url.href);
      window.__devBlockedNav = url.href;
    }
  }, true);
})();

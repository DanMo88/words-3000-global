/* PWA install button (Android / iPhone / desktop), strings via window.__t (i18n) — wires every [data-install] element.
   Classic script loaded early so beforeinstallprompt is never missed. Hidden when running as an installed app. */
(function () {
  var deferred = null, doc = document.documentElement;
  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR|FxiOS|Firefox|SamsungBrowser/i.test(ua);
  var isFirefox = /Firefox|FxiOS/i.test(ua);
  var titleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  var NAME = (titleMeta && titleMeta.content) || document.title;

  function standalone() {
    return (window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: minimal-ui)').matches || matchMedia('(display-mode: window-controls-overlay)').matches)) || navigator.standalone === true;
  }
  function refresh() { doc.classList.toggle('pwa-standalone', standalone()); }
  refresh();

  var css = '.pwa-standalone [data-install],.pwa-standalone .pwa-install{display:none!important}' +
    '.pwa-dlg{border:0;border-radius:20px;padding:20px;width:min(440px,92vw);background:#fff;color:#222;box-shadow:0 30px 80px rgba(0,0,0,.3);font-family:inherit;text-align:start}' +
    '.pwa-dlg::backdrop{background:rgba(0,0,0,.45)}.pwa-dlg h3{margin:0 0 10px;font-size:1.1rem}.pwa-dlg ol{margin:0 0 10px;padding-inline-start:22px;padding-inline-end:0;line-height:1.9}' +
    '.pwa-dlg .en{direction:ltr;unicode-bidi:isolate;font-weight:700}.pwa-dlg .note{font-size:.9rem;opacity:.75;margin:0 0 14px}' +
    '.pwa-dlg .ok{display:block;width:100%;border:0;border-radius:14px;padding:12px;font:inherit;font-weight:700;color:#fff;background:var(--pwa-accent,#4f46e5);cursor:pointer}' +
    '.pwa-dlg svg{vertical-align:-3px;color:var(--pwa-accent,#4f46e5)}';
  var st = document.createElement('style'); st.textContent = css; (document.head || doc).appendChild(st);

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () {}); });
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', function () { deferred = null; refresh(); });
  if (window.matchMedia) { try { matchMedia('(display-mode: standalone)').addEventListener('change', refresh); } catch (_) {} }

  var share = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2l4 4-1.4 1.4L13 5.8V15h-2V5.8L9.4 7.4 8 6l4-4zM5 10h3v2H6v8h12v-8h-2v-2h3a1 1 0 011 1v10a1 1 0 01-1 1H5a1 1 0 01-1-1V11a1 1 0 011-1z"/></svg>';
  function en(s) { return '<span class="en">' + s + '</span>'; }
  function T(k, v) { return window.__t ? window.__t(k, v) : k; }
  function modal(title, steps) {
    var d = document.createElement('dialog'); d.className = 'pwa-dlg'; d.setAttribute('dir', doc.dir || 'ltr'); d.setAttribute('lang', doc.lang || 'en');
    var nm = (titleMeta && titleMeta.content) || NAME;
    d.innerHTML = '<form method="dialog"><h3>' + title + '</h3><ol>' + steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' +
      '<p class="note">' + T('dlgNote', { name: '<span class="en">' + nm + '</span>' }) + '</p>' +
      '<button class="ok" value="ok">' + T('dlgOk') + '</button></form>';
    document.body.appendChild(d);
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
    d.addEventListener('close', function () { d.remove(); });
  }
  function install() {
    if (standalone()) return;
    if (deferred) { deferred.prompt(); deferred.userChoice.finally(function () { deferred = null; refresh(); }); return; }
    if (isIOS) {
      modal(T('dlgIosTitle'), isSafari
        ? [T('dlgIosSafari1', { share: share }), T('dlgIosSafari2', { a: en('Add to Home Screen') }), T('dlgIosSafari3', { a: en('Add') })]
        : [T('dlgIosOther1', { a: en('Safari') }), T('dlgIosOther2', { share: share }), T('dlgIosOther3', { a: en('Add to Home Screen'), b: en('Add') })]);
      return;
    }
    if (isAndroid) { modal(T('dlgAndroidTitle'), [T('dlgAndroid1', { a: en('⋮') }), T('dlgAndroid2', { a: en('Install app'), b: en('Add to Home screen') }), T('dlgAndroid3')]); return; }
    if (isSafari) { modal(T('dlgMacTitle'), [T('dlgMac1', { a: en('File') }), T('dlgMac2', { a: en('Add to Dock…'), b: en('Add') })]); return; }
    if (isFirefox) { modal(T('dlgPcTitle'), [T('dlgFirefox1'), T('dlgFirefox2', { a: en('Chrome'), b: en('Edge') })]); return; }
    modal(T('dlgPcTitle'), [T('dlgPc1', { a: en('⊕') }), T('dlgPc2', { a: en('⋮'), b: en('Install') + ' / ' + en('Apps → Install this site as an app') })]);
  }
  window.pwaInstall = install;
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-install]');
    if (t) { e.preventDefault(); install(); }
  });
})();

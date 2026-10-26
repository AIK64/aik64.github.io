(function () {
  'use strict';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  function preference() {
    try { return localStorage.getItem('pref-theme'); } catch { return null; }
  }
  function apply(theme) {
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
    const button = document.getElementById('blog-theme-toggle');
    if (button) {
      button.setAttribute('aria-label', theme === 'dark' ? '切换到浅色模式' : '切换到深色模式');
      button.setAttribute('aria-pressed', String(theme === 'dark'));
    }
    // Decap renders its preview in an iframe. Only touch same-origin preview documents.
    document.querySelectorAll('iframe').forEach(frame => {
      try {
        if (frame.contentDocument) frame.contentDocument.documentElement.dataset.theme = theme;
      } catch { /* Cross-origin frames keep their own theme. */ }
    });
  }
  function sync() { apply(preference() || (system.matches ? 'dark' : 'light')); }
  sync();
  system.addEventListener('change', () => { if (!preference()) sync(); });
  window.addEventListener('storage', event => { if (event.key === 'pref-theme' || event.key === null) sync(); });
  document.addEventListener('DOMContentLoaded', () => {
    sync();
    document.getElementById('blog-theme-toggle').addEventListener('click', () => {
      const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('pref-theme', theme); } catch { /* Still allow switching for this visit. */ }
      apply(theme);
    });
  });
})();

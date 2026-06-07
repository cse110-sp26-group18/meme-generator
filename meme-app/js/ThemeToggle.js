/**
 * ThemeToggle (#89)
 *
 * Manages the page's light/dark theme via a `data-theme` attribute on
 * <html>. The current choice is persisted in localStorage and synced with
 * the user's OS preference on first visit.
 *
 * Public API:
 *   init({ toggle })          — wire a button element as the theme toggle.
 *                               Applies the saved/preferred theme on init.
 *   getTheme()                — returns 'light' | 'dark'
 *   setTheme(name, { source })— sets the theme. `source` controls whether
 *                               localStorage is updated ('user' or 'system';
 *                               only 'user' persists).
 *
 * Storage key: `mg.theme`. Values: 'light' or 'dark'. Anything else is
 * treated as no preference and we fall back to system.
 */
var MemeGen = window.MemeGen || {};

MemeGen.ThemeToggle = (function () {
  var STORAGE_KEY = 'mg.theme';

  var toggleEl = null;

  // ── Storage helpers (defensive — private browsing throws on Storage) ──

  function readStored() {
    try {
      var v = window.localStorage.getItem(STORAGE_KEY);
      return v === 'light' || v === 'dark' ? v : null;
    } catch (e) {
      return null;
    }
  }

  function writeStored(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (e) { /* ignore */ }
  }

  // ── System preference ────────────────────────────────────────────────

  function systemPrefersDark() {
    return typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // ── Apply / read ─────────────────────────────────────────────────────

  function applyToDom(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (toggleEl) {
      var dark = theme === 'dark';
      // aria-pressed already conveys the toggle's on/off state. The aria-label
      // stays static ("Toggle dark mode") to avoid the screen-reader anti-
      // pattern of announcing "Switch to light mode, toggle button, pressed".
      // Only the visible title (hover tooltip) describes the next action.
      toggleEl.setAttribute('aria-pressed', String(dark));
      toggleEl.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  function getTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function setTheme(name, opts) {
    if (name !== 'light' && name !== 'dark') return;
    applyToDom(name);
    if (opts && opts.source === 'user') writeStored(name);
  }

  function toggle() {
    setTheme(getTheme() === 'dark' ? 'light' : 'dark', { source: 'user' });
  }

  // ── Init ─────────────────────────────────────────────────────────────

  function init(opts) {
    // If a previous init() bound a toggle, detach that listener first so
    // re-initialization (tests, SPA-like flows) doesn't stack handlers.
    if (toggleEl) {
      toggleEl.removeEventListener('click', toggle);
    }
    toggleEl = (opts && opts.toggle) || null;

    var stored = readStored();
    var initial = stored || (systemPrefersDark() ? 'dark' : 'light');
    // First paint: don't persist (we only know it's the user's preference
    // when they click the toggle).
    applyToDom(initial);

    if (toggleEl) {
      toggleEl.addEventListener('click', toggle);
    }
  }

  return {
    init: init,
    getTheme: getTheme,
    setTheme: setTheme,
    toggle: toggle,
    // Exposed for tests
    _STORAGE_KEY: STORAGE_KEY
  };
})();

window.MemeGen = MemeGen;

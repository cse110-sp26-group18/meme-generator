/**
 * theme_toggle.test.js
 * Verifies the dark/light theme toggle (#89).
 *
 * Covers:
 *  - Initial paint: with nothing saved, falls back to system preference.
 *  - Saved preference wins over system preference on init.
 *  - Clicking the toggle flips data-theme and persists to localStorage.
 *  - aria-pressed and title attributes reflect the current theme.
 *  - setTheme with source: 'system' applies the DOM change but does NOT
 *    persist (so the user's saved choice isn't overwritten by system).
 *  - Theme survives a fresh init() call (round-trip through localStorage).
 *
 * Module under test: meme-app/js/ThemeToggle.js
 */

function makeToggleButton() {
  document.body.innerHTML = `
    <button id="theme-toggle" aria-pressed="false" aria-label="Toggle dark mode" title="Toggle dark mode">
      <span class="theme-toggle-track"></span>
    </button>
  `;
  return document.getElementById('theme-toggle');
}

function setSystemPrefersDark(dark) {
  // jsdom matchMedia: stub it to return whatever we want for the dark query.
  window.matchMedia = jest.fn(function (query) {
    return {
      matches: query === '(prefers-color-scheme: dark)' ? dark : false,
      media: query,
      addEventListener: function () {},
      removeEventListener: function () {},
    };
  });
}

beforeEach(() => {
  jest.resetModules();
  delete window.MemeGen.ThemeToggle;
  require('../meme-app/js/ThemeToggle.js');
  document.documentElement.removeAttribute('data-theme');
  window.localStorage.clear();
});

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  window.localStorage.clear();
  document.body.innerHTML = '';
  jest.restoreAllMocks();
});

// ── Initial paint ─────────────────────────────────────────────────────────────

describe('ThemeToggle — initial paint', () => {
  it('defaults to light when no preference is saved and system is light', () => {
    setSystemPrefersDark(false);
    MemeGen.ThemeToggle.init({ toggle: makeToggleButton() });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(MemeGen.ThemeToggle.getTheme()).toBe('light');
  });

  it('defaults to dark when no preference is saved and system prefers dark', () => {
    setSystemPrefersDark(true);
    MemeGen.ThemeToggle.init({ toggle: makeToggleButton() });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(MemeGen.ThemeToggle.getTheme()).toBe('dark');
  });

  it('uses the saved preference over the system preference', () => {
    setSystemPrefersDark(false);
    window.localStorage.setItem('mg.theme', 'dark');
    MemeGen.ThemeToggle.init({ toggle: makeToggleButton() });
    expect(MemeGen.ThemeToggle.getTheme()).toBe('dark');
  });

  it('ignores garbage values in storage and falls back to system', () => {
    setSystemPrefersDark(true);
    window.localStorage.setItem('mg.theme', 'sepia-tone');
    MemeGen.ThemeToggle.init({ toggle: makeToggleButton() });
    expect(MemeGen.ThemeToggle.getTheme()).toBe('dark');
  });

  it('does NOT persist the initial system-derived choice', () => {
    setSystemPrefersDark(true);
    MemeGen.ThemeToggle.init({ toggle: makeToggleButton() });
    expect(window.localStorage.getItem('mg.theme')).toBeNull();
  });
});

// ── User interaction ──────────────────────────────────────────────────────────

describe('ThemeToggle — clicking the toggle', () => {
  beforeEach(() => setSystemPrefersDark(false));

  it('flips light → dark and persists to localStorage', () => {
    const btn = makeToggleButton();
    MemeGen.ThemeToggle.init({ toggle: btn });
    expect(MemeGen.ThemeToggle.getTheme()).toBe('light');

    btn.click();

    expect(MemeGen.ThemeToggle.getTheme()).toBe('dark');
    expect(window.localStorage.getItem('mg.theme')).toBe('dark');
  });

  it('flips dark → light on a second click', () => {
    const btn = makeToggleButton();
    MemeGen.ThemeToggle.init({ toggle: btn });
    btn.click(); // → dark
    btn.click(); // → light
    expect(MemeGen.ThemeToggle.getTheme()).toBe('light');
    expect(window.localStorage.getItem('mg.theme')).toBe('light');
  });

  it('updates aria-pressed in lockstep with the theme', () => {
    const btn = makeToggleButton();
    MemeGen.ThemeToggle.init({ toggle: btn });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    btn.click();
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    btn.click();
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('updates title and aria-label to describe the next click', () => {
    const btn = makeToggleButton();
    MemeGen.ThemeToggle.init({ toggle: btn });
    expect(btn.getAttribute('title')).toMatch(/switch to dark/i);
    btn.click();
    expect(btn.getAttribute('title')).toMatch(/switch to light/i);
    expect(btn.getAttribute('aria-label')).toMatch(/switch to light/i);
  });
});

// ── setTheme API ──────────────────────────────────────────────────────────────

describe('ThemeToggle.setTheme', () => {
  beforeEach(() => {
    setSystemPrefersDark(false);
    MemeGen.ThemeToggle.init({ toggle: makeToggleButton() });
  });

  it('user source persists', () => {
    MemeGen.ThemeToggle.setTheme('dark', { source: 'user' });
    expect(MemeGen.ThemeToggle.getTheme()).toBe('dark');
    expect(window.localStorage.getItem('mg.theme')).toBe('dark');
  });

  it('system source applies but does not persist', () => {
    MemeGen.ThemeToggle.setTheme('dark', { source: 'system' });
    expect(MemeGen.ThemeToggle.getTheme()).toBe('dark');
    expect(window.localStorage.getItem('mg.theme')).toBeNull();
  });

  it('ignores unknown theme names', () => {
    MemeGen.ThemeToggle.setTheme('high-contrast', { source: 'user' });
    expect(MemeGen.ThemeToggle.getTheme()).toBe('light');
  });
});

// ── Round-trip via localStorage ───────────────────────────────────────────────

describe('ThemeToggle — round-trip', () => {
  it('a user-set theme survives re-initialization', () => {
    setSystemPrefersDark(false);
    const btn1 = makeToggleButton();
    MemeGen.ThemeToggle.init({ toggle: btn1 });
    btn1.click(); // → dark, persisted

    // Simulate page reload: fresh module + DOM.
    jest.resetModules();
    delete window.MemeGen.ThemeToggle;
    document.documentElement.removeAttribute('data-theme');
    require('../meme-app/js/ThemeToggle.js');

    const btn2 = makeToggleButton();
    MemeGen.ThemeToggle.init({ toggle: btn2 });
    expect(MemeGen.ThemeToggle.getTheme()).toBe('dark');
    expect(btn2.getAttribute('aria-pressed')).toBe('true');
  });
});

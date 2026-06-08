/**
 * Jest global setup — runs before every test file.
 *
 * Responsibilities:
 *  1. Mock browser APIs that jsdom does not provide (URL, anchor click)
 *  2. Load all MemeGen modules into the jsdom global (window.MemeGen)
 *
 * Note on module state: these IIFEs execute once and write to window.MemeGen.
 * Closure-level state inside each module (e.g. TextBoxManager.textBoxes)
 * persists across tests. Individual test files handle isolation via DOM
 * cleanup and explicit state resets where the module API allows it.
 */

// ── URL API mocks ─────────────────────────────────────────────────────────────
// jsdom does not implement URL.createObjectURL or URL.revokeObjectURL.
global.URL.createObjectURL = () => 'blob:mock-url';
global.URL.revokeObjectURL = () => {};

// ── Viewport + font size mocks ────────────────────────────────────────────────
// Set a large viewport so viewport-aware canvas sizing does not alter existing
// test expectations (maxW and maxH both resolve to 800, matching the old constants).
Object.defineProperty(window, 'innerWidth',  { writable: true, configurable: true, value: 1600 });
Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 1200 });

// jsdom does not implement getComputedStyle().fontSize for the root element;
// stub it to return 16px so rem calculations work in ImageLoader.fitWithinRange.
const _origGetComputedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = function (el, pseudo) {
  const style = _origGetComputedStyle(el, pseudo);
  if (el === document.documentElement) {
    return Object.assign(Object.create(style), { fontSize: '16px' });
  }
  return style;
};

// Prevent anchor .click() from throwing in jsdom (used by Exporter download).
HTMLAnchorElement.prototype.click = function () {};

// ── Load MemeGen modules in dependency order ───────────────────────────────
require('../meme-app/js/LayoutManager.js');
require('../meme-app/js/ImageLoader.js');
require('../meme-app/js/Inpaint.js');
require('../meme-app/js/TextBox.js');
require('../meme-app/js/DragResize.js');
require('../meme-app/js/TextBoxManager.js');
require('../meme-app/js/Exporter.js');
require('../meme-app/js/TextRecognizer.js');
require('../meme-app/js/MemeSearch.js');
require('../meme-app/js/ThemeToggle.js');

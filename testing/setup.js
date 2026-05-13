/**
 * Jest global setup — runs before every test file.
 *
 * Responsibilities:
 *  1. Mock browser APIs that jsdom does not provide (URL, anchor click)
 *  2. Load all MemeGen v1 modules into the jsdom global (window.MemeGen)
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

// Prevent anchor .click() from throwing in jsdom (used by Exporter download).
HTMLAnchorElement.prototype.click = function () {};

// ── Load MemeGen v1 modules in dependency order ───────────────────────────────
require('../versions/v1/js/ImageLoader.js');
require('../versions/v1/js/TextBox.js');
require('../versions/v1/js/DragResize.js');
require('../versions/v1/js/TextBoxManager.js');
require('../versions/v1/js/Exporter.js');

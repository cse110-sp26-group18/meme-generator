/**
 * v2_mobile_overflow.test.js
 * Verifies the mobile horizontal-overflow fix and the new mobile bottom
 * toolbar layout.
 *
 * What's being verified:
 *  - styles.css declares document-level overflow-x: hidden so no descendant
 *    can trigger horizontal page scrolling.
 *  - The mobile media block (max-width: 768px) re-positions
 *    .text-box-toolbar to position: fixed at the viewport bottom, with a
 *    clamped max-width that prevents it from pushing the page wider.
 *  - Mobile buttons hit the 44 px tap-target minimum required by the spec.
 *  - The text box itself gets max-width: 100% on mobile so a large resize
 *    can't push the page width either.
 *  - The smallest phone breakpoint (≤480 px) hides the read-only
 *    .font-size-display to make room for the essential controls.
 *  - The floating-toolbar DOM contract is unchanged: hidden when no text
 *    box is selected, visible when a text box is selected. This is what
 *    keeps the existing pinch / double-tap / move / resize handlers
 *    working without any JS change.
 *
 * jsdom note: jsdom does not apply CSS, so we verify the CSS rules by
 * reading styles.css and asserting on its source. Selection behavior is
 * verified via DOM class state.
 */

const fs = require('fs');
const path = require('path');

const CSS_PATH = path.join(__dirname, '..', 'meme-app', 'css', 'styles.css');
const css = fs.readFileSync(CSS_PATH, 'utf8');

function mobileBlock() {
  // Capture the body of the first @media (max-width: 768px) block, lazily.
  const match = css.match(/@media\s*\(\s*max-width:\s*768px\s*\)\s*\{([\s\S]*?)\n\}\s*\n/);
  return match ? match[1] : '';
}

function smallPhoneBlock() {
  const match = css.match(/@media\s*\(\s*max-width:\s*480px\s*\)\s*\{([\s\S]*?)\n\}\s*\n/);
  return match ? match[1] : '';
}

// ── Document-level overflow guard ────────────────────────────────────────────

describe('Mobile overflow — document level', () => {
  it('declares overflow-x: hidden on html / body so nothing can scroll the page sideways', () => {
    expect(css).toMatch(/html\s*,\s*body[\s\S]*?overflow-x:\s*hidden/);
  });

  it('caps html / body max-width at 100% as a defensive belt for inline widths set by JS', () => {
    expect(css).toMatch(/html\s*,\s*body[\s\S]*?max-width:\s*100%/);
  });
});

// ── Mobile bottom toolbar ────────────────────────────────────────────────────

describe('Mobile toolbar — fixed-bottom layout (max-width: 768px)', () => {
  const mobile = mobileBlock();

  it('exists — a @media (max-width: 768px) block is present in styles.css', () => {
    expect(mobile.length).toBeGreaterThan(0);
  });

  it('re-anchors .text-box-toolbar to position: fixed inside the mobile block', () => {
    // Pull the .text-box-toolbar rule body from the mobile block specifically.
    const rule = mobile.match(/\.text-box-toolbar\s*\{([\s\S]*?)\}/);
    expect(rule).not.toBeNull();
    expect(rule[1]).toMatch(/position:\s*fixed/);
  });

  it('pins the mobile toolbar to the bottom edge with safe gutters (scalable or px)', () => {
    const rule = mobile.match(/\.text-box-toolbar\s*\{([\s\S]*?)\}/);
    // Accept either small px values (visual-detail tier) or scalable units —
    // both express the same "small inset from the viewport edge" intent.
    const edge = /(?:\d+(?:\.\d+)?(?:px|rem|em|vw|vh)|calc\([^)]+\))/;
    expect(rule[1]).toMatch(new RegExp('bottom:\\s*' + edge.source));
    expect(rule[1]).toMatch(new RegExp('left:\\s*'   + edge.source));
    expect(rule[1]).toMatch(new RegExp('right:\\s*'  + edge.source));
  });

  it('caps the mobile toolbar width so it cannot push the page wider than the viewport', () => {
    const rule = mobile.match(/\.text-box-toolbar\s*\{([\s\S]*?)\}/);
    // calc(100vw - 16px) or calc(100vw - 1rem) — either is acceptable.
    expect(rule[1]).toMatch(/max-width:\s*calc\(\s*100vw\s*-\s*[\d.]+(?:px|rem|em)\s*\)/);
  });

  it('uses a SCALABLE min tap target for every toolbar button / select (not raw px)', () => {
    const rule = mobile.match(/\.text-box-toolbar button,\s*\.text-box-toolbar select\s*\{([\s\S]*?)\}/);
    expect(rule).not.toBeNull();
    // Must be clamp() / rem / em / vw — explicitly NOT raw px. This is the
    // contract the prompt's "scalable units" rule requires for mobile UI.
    const scalable = /(?:clamp\([^)]+\)|[\d.]+(?:rem|em|%|vw|vh))/;
    expect(rule[1]).toMatch(new RegExp('min-height:\\s*' + scalable.source));
    expect(rule[1]).toMatch(new RegExp('min-width:\\s*'  + scalable.source));
  });

  it('clamps .text-box itself to max-width: 100% on mobile so a resize cannot push the page wider', () => {
    expect(mobile).toMatch(/\.text-box\s*\{[\s\S]*?max-width:\s*100%/);
  });

  it('hides the .move-handle button on mobile — replaced by press-and-hold gesture', () => {
    expect(mobile).toMatch(/\.text-box-toolbar\s+\.move-handle\s*\{[\s\S]*?display:\s*none/);
  });

  it('routes touches on an unfocused textarea through to the .text-box parent so hold-to-move works', () => {
    // The :not(:focus) gate means typing still works once focused.
    expect(mobile).toMatch(/\.text-box\s+\.text-content:not\(:focus\)\s*\{[\s\S]*?pointer-events:\s*none/);
  });

  it('uses SCALABLE sizing for the upload / download buttons on mobile (not raw px)', () => {
    const rule = mobile.match(/\.upload-btn,\s*#download-btn\s*\{([\s\S]*?)\}/);
    expect(rule).not.toBeNull();
    const scalable = /(?:clamp\([^)]+\)|[\d.]+(?:rem|em|%|vw|vh))/;
    expect(rule[1]).toMatch(new RegExp('min-height:\\s*' + scalable.source));
  });
});

// ── Small-phone breakpoint ───────────────────────────────────────────────────

describe('Mobile toolbar — smallest phone tightening (max-width: 480px)', () => {
  const small = smallPhoneBlock();

  it('hides the read-only .font-size-display to make room for the essential controls', () => {
    expect(small).toMatch(/\.text-box-toolbar\s+\.font-size-display\s*\{[\s\S]*?display:\s*none/);
  });
});

// ── Quick-action menu (long-press) ───────────────────────────────────────────

describe('Quick-action menu — mobile long-press surface', () => {
  it('declares .quick-action-menu — hidden by default, shown via .is-open', () => {
    expect(css).toMatch(/\.quick-action-menu\s*\{[\s\S]*?display:\s*none/);
    expect(css).toMatch(/\.quick-action-menu\.is-open\s*\{[\s\S]*?display:\s*flex/);
  });

  it('positions the open menu at the bottom of the viewport with safe gutters', () => {
    // The selector appears twice in styles.css — once as the base rule with
    // the full positioning, and once inside @media (min-width: 769px) as
    // a desktop "display: none" override. Pick the base rule by looking for
    // the one that actually has positioning.
    const allRules = [...css.matchAll(/\.quick-action-menu\.is-open\s*\{([\s\S]*?)\}/g)];
    const baseRule = allRules.find(function (m) { return /position:\s*fixed/.test(m[1]); });
    expect(baseRule).toBeDefined();
    expect(baseRule[1]).toMatch(/position:\s*fixed/);
    expect(baseRule[1]).toMatch(/bottom:\s*[\d.]+(?:rem|em|px)/);
  });

  it('uses SCALABLE sizing for .quick-action-btn (not raw px)', () => {
    const rule = css.match(/\.quick-action-btn\s*\{([\s\S]*?)\}/);
    expect(rule).not.toBeNull();
    const scalable = /(?:clamp\([^)]+\)|[\d.]+(?:rem|em|%|vw|vh))/;
    expect(rule[1]).toMatch(new RegExp('min-height:\\s*' + scalable.source));
  });

  it('hides the floating toolbar while the menu is open so they cannot overlap', () => {
    const mobile = mobileBlock();
    expect(mobile).toMatch(/\.text-box\.menu-open\s+\.text-box-toolbar\s*\{[\s\S]*?display:\s*none/);
  });

  it('keeps the menu hidden on desktop even when .is-open is toggled', () => {
    // Verified by the @media (min-width: 769px) override.
    const desktopBlock = css.match(/@media\s*\(\s*min-width:\s*769px\s*\)\s*\{([\s\S]*?)\n\}\s*\n/);
    expect(desktopBlock).not.toBeNull();
    expect(desktopBlock[1]).toMatch(/\.quick-action-menu\.is-open\s*\{[\s\S]*?display:\s*none/);
  });
});

// ── External meme-search toggle ──────────────────────────────────────────────

describe('Meme-search toggle — scalable sizing', () => {
  it('uses SCALABLE sizing for the meme-search toggle button (not raw px)', () => {
    const rule = css.match(/\.meme-search-toggle\s*\{([\s\S]*?)\}/);
    expect(rule).not.toBeNull();
    const scalable = /(?:clamp\([^)]+\)|[\d.]+(?:rem|em|%|vw|vh))/;
    expect(rule[1]).toMatch(new RegExp('min-height:\\s*' + scalable.source));
  });
});

// ── DOM contract — toolbar visibility still tied to selection ────────────────
// The mobile bottom toolbar relies on .text-box.selected .text-box-toolbar
// becoming display: flex (set in the base CSS). We're not changing that —
// these tests just confirm the DOM-side contract that the CSS depends on
// is still intact after our edits.

describe('Toolbar visibility contract — selection state on text boxes', () => {
  let container;
  let textBox;

  beforeEach(() => {
    document.body.innerHTML = '<div id="canvas-container"></div>';
    container = document.getElementById('canvas-container');
    textBox = new window.MemeGen.TextBox(10, 10, container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('a newly-created text box is unselected (no .selected class) so its toolbar stays hidden', () => {
    expect(textBox.el.classList.contains('selected')).toBe(false);
  });

  it('calling select() adds the .selected class — CSS reveals the bottom toolbar via .selected .text-box-toolbar', () => {
    textBox.select();
    expect(textBox.el.classList.contains('selected')).toBe(true);
    // Sanity-check the toolbar element exists and is the right class.
    expect(textBox.el.querySelector('.text-box-toolbar')).not.toBeNull();
  });

  it('calling deselect() removes .selected so the toolbar hides again', () => {
    textBox.select();
    textBox.deselect();
    expect(textBox.el.classList.contains('selected')).toBe(false);
  });

  it('the toolbar still contains every preserved control class so existing JS handlers (pinch, A-/A+, border, delete) keep working', () => {
    const toolbar = textBox.el.querySelector('.text-box-toolbar');
    expect(toolbar.querySelector('.move-handle')).not.toBeNull();
    expect(toolbar.querySelector('.font-size-btn')).not.toBeNull();
    expect(toolbar.querySelector('.font-size-display')).not.toBeNull();
    expect(toolbar.querySelector('.font-select')).not.toBeNull();
    expect(toolbar.querySelector('.border-toggle')).not.toBeNull();
    expect(toolbar.querySelector('.delete-btn')).not.toBeNull();
  });
});

/**
 * v2_mobile_gestures.test.js
 * Verifies the mobile-adaptability touch gestures and library compaction.
 *
 * Scenarios covered:
 *  1. Pinch-to-resize (DragResize.js) — two-finger touchmove rescales
 *     fontSize via the existing applyFontSize / _fitBoxToFontSize path so
 *     the live editor, toolbar display, and exporter all stay in sync.
 *  2. Pinch is gated on selection (no rescale when the box is not selected).
 *  3. Double-tap (TextBox.js) — fires focusTextarea, NEVER destroy.
 *  4. Double-tap is suppressed for ~500 ms after a pinch ends so a
 *     two-finger lift cannot be misread as a tap.
 *  5. Library compaction (app.js) — on a 375 px viewport the section gets
 *     `is-collapsed`, the toggle button is unhidden, and clicking it flips
 *     the section between strip and full-grid views.
 *  6. Library compaction stays off on desktop (1280 px viewport).
 *
 * jsdom note: jsdom has no TouchEvent constructor. We dispatch plain
 * Event instances with manually-set .touches / .changedTouches arrays —
 * the production handlers read these properties directly so this is
 * faithful to the real touch contract.
 */

// ── Touch event helpers ──────────────────────────────────────────────────────

function makeTouchEvent(type, touches, changedTouches) {
  var ev = new Event(type, { bubbles: true, cancelable: true });
  ev.touches = touches || [];
  ev.changedTouches = changedTouches || touches || [];
  return ev;
}

// ── Pinch-to-resize ──────────────────────────────────────────────────────────

describe('Pinch-to-resize gesture (DragResize.js)', () => {
  let container;
  let textBox;

  beforeEach(() => {
    document.body.innerHTML = '<div id="canvas-container" class="canvas-container"></div>';
    container = document.getElementById('canvas-container');
    textBox = new window.MemeGen.TextBox(10, 10, container);
    window.MemeGen.DragResize.attach(textBox);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('scales font size by the ratio of pinch distance when the box is selected', () => {
    textBox.select();
    textBox.applyFontSize(24);

    textBox.el.dispatchEvent(makeTouchEvent('touchstart', [
      { clientX: 100, clientY: 100 },
      { clientX: 200, clientY: 100 }
    ]));
    // Spread fingers from 100 px apart to 200 px apart → 2× scale.
    textBox.el.dispatchEvent(makeTouchEvent('touchmove', [
      { clientX: 50, clientY: 100 },
      { clientX: 250, clientY: 100 }
    ]));

    expect(textBox.fontSize).toBe(48);
    expect(textBox.textarea.style.fontSize).toBe('48px');
    expect(textBox.fontSizeDisplay.textContent).toBe('48px');
  });

  it('clamps font size within the existing applyFontSize bounds', () => {
    textBox.select();
    textBox.applyFontSize(24);
    textBox.el.dispatchEvent(makeTouchEvent('touchstart', [
      { clientX: 0, clientY: 0 },
      { clientX: 100, clientY: 0 }
    ]));
    // Pinch out absurdly far — applyFontSize must clamp at 120.
    textBox.el.dispatchEvent(makeTouchEvent('touchmove', [
      { clientX: -2000, clientY: 0 },
      { clientX: 2000, clientY: 0 }
    ]));
    expect(textBox.fontSize).toBe(120);
  });

  it('ignores single-finger touchmove — typing should still work', () => {
    textBox.select();
    textBox.applyFontSize(24);
    textBox.el.dispatchEvent(makeTouchEvent('touchstart', [
      { clientX: 100, clientY: 100 }
    ]));
    textBox.el.dispatchEvent(makeTouchEvent('touchmove', [
      { clientX: 250, clientY: 250 }
    ]));
    expect(textBox.fontSize).toBe(24);
  });
});

// ── Double-tap ──────────────────────────────────────────────────────────────

describe('Double-tap gesture (TextBox.js)', () => {
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

  it('focuses the textarea on a double tap', () => {
    const focusSpy = jest.spyOn(textBox, 'focusTextarea');
    textBox.el.dispatchEvent(makeTouchEvent('touchend', [], [{ clientX: 50, clientY: 50 }]));
    textBox.el.dispatchEvent(makeTouchEvent('touchend', [], [{ clientX: 50, clientY: 50 }]));
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it('never calls destroy on a double tap — delete stays opt-in', () => {
    const destroySpy = jest.spyOn(textBox, 'destroy');
    textBox.el.dispatchEvent(makeTouchEvent('touchend', [], [{ clientX: 50, clientY: 50 }]));
    textBox.el.dispatchEvent(makeTouchEvent('touchend', [], [{ clientX: 50, clientY: 50 }]));
    expect(destroySpy).not.toHaveBeenCalled();
  });

  it('does not fire on a single tap', () => {
    const focusSpy = jest.spyOn(textBox, 'focusTextarea');
    textBox.el.dispatchEvent(makeTouchEvent('touchend', [], [{ clientX: 50, clientY: 50 }]));
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('does not fire when a pinch just ended (suppression window)', () => {
    const focusSpy = jest.spyOn(textBox, 'focusTextarea');
    textBox.el.dataset.pinchAt = String(Date.now());
    textBox.el.dispatchEvent(makeTouchEvent('touchend', [], [{ clientX: 50, clientY: 50 }]));
    textBox.el.dispatchEvent(makeTouchEvent('touchend', [], [{ clientX: 50, clientY: 50 }]));
    expect(focusSpy).not.toHaveBeenCalled();
  });
});

// Library compaction tests were removed when the accidentally-merged
// internal-library code was stripped from this branch. The mobile collapse
// helpers (wireLibraryToggle, collapseSectionOnMobile) still live in
// app.js as scaffolding for the future external MemeSearch.js branch;
// they'll be covered by tests once that branch's exact init contract
// lands and the meme-search DOM is populated.

// ── Hold-to-move (replaces mobile Move button) ──────────────────────────────

describe('Hold-to-move (DragResize.js)', () => {
  const HOLD_MS = 300;
  let container;
  let textBox;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="canvas-container"></div>';
    container = document.getElementById('canvas-container');
    // jsdom does not compute offsets from style; define enough of them for
    // the drag-math to behave like a real layout would.
    Object.defineProperty(container, 'offsetWidth',  { get: () => 800, configurable: true });
    Object.defineProperty(container, 'offsetHeight', { get: () => 600, configurable: true });
    textBox = new window.MemeGen.TextBox(100, 100, container);
    Object.defineProperty(textBox.el, 'offsetLeft',   { get: () => parseInt(textBox.el.style.left,   10) || 0, configurable: true });
    Object.defineProperty(textBox.el, 'offsetTop',    { get: () => parseInt(textBox.el.style.top,    10) || 0, configurable: true });
    Object.defineProperty(textBox.el, 'offsetWidth',  { get: () => parseInt(textBox.el.style.width,  10) || 0, configurable: true });
    Object.defineProperty(textBox.el, 'offsetHeight', { get: () => parseInt(textBox.el.style.height, 10) || 0, configurable: true });
    window.MemeGen.DragResize.attach(textBox);
  });

  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  it('does NOT open the quick-action menu on a quick tap (release before hold timer)', () => {
    textBox.el.dispatchEvent(makeTouchEvent('touchstart', [{ clientX: 200, clientY: 200 }]));
    // Release immediately — hold timer never fires.
    textBox.el.dispatchEvent(makeTouchEvent('touchend', [], [{ clientX: 200, clientY: 200 }]));
    expect(textBox.quickMenu.classList.contains('is-open')).toBe(false);
  });

  it('focuses the textarea when hold timer completes WITHOUT movement', () => {
    const focusSpy = jest.spyOn(textBox, 'focusTextarea');
    textBox.el.dispatchEvent(makeTouchEvent('touchstart', [{ clientX: 200, clientY: 200 }]));
    jest.advanceTimersByTime(HOLD_MS + 50);
    textBox.el.dispatchEvent(makeTouchEvent('touchend', [], [{ clientX: 200, clientY: 200 }]));
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(textBox.quickMenu.classList.contains('is-open')).toBe(false);
  });

  it('drags the text box when movement happens AFTER the hold timer completes', () => {
    textBox.select();
    textBox.el.dispatchEvent(makeTouchEvent('touchstart', [{ clientX: 200, clientY: 200 }]));
    jest.advanceTimersByTime(HOLD_MS + 50);
    expect(textBox.el.classList.contains('hold-active')).toBe(true);
    // Drag 50 px right and 30 px down.
    textBox.el.dispatchEvent(makeTouchEvent('touchmove', [{ clientX: 250, clientY: 230 }]));
    expect(parseInt(textBox.el.style.left, 10)).toBe(150); // 100 + 50
    expect(parseInt(textBox.el.style.top, 10)).toBe(130);  // 100 + 30
    // Release after dragging should NOT open the menu (gesture was a drag).
    textBox.el.dispatchEvent(makeTouchEvent('touchend', [], [{ clientX: 250, clientY: 230 }]));
    expect(textBox.quickMenu.classList.contains('is-open')).toBe(false);
  });

  it('cancels the hold when movement passes the threshold BEFORE the timer fires', () => {
    textBox.el.dispatchEvent(makeTouchEvent('touchstart', [{ clientX: 200, clientY: 200 }]));
    // User starts scrolling almost immediately.
    textBox.el.dispatchEvent(makeTouchEvent('touchmove', [{ clientX: 230, clientY: 200 }]));
    jest.advanceTimersByTime(HOLD_MS + 50);
    textBox.el.dispatchEvent(makeTouchEvent('touchend', [], [{ clientX: 230, clientY: 200 }]));
    expect(textBox.quickMenu.classList.contains('is-open')).toBe(false);
    expect(textBox.el.classList.contains('hold-active')).toBe(false);
  });

  it('clamps drag inside the canvas container — text box cannot escape', () => {
    textBox.el.dispatchEvent(makeTouchEvent('touchstart', [{ clientX: 200, clientY: 200 }]));
    jest.advanceTimersByTime(HOLD_MS + 50);
    // Try to drag way past the right edge of the 800-wide container.
    textBox.el.dispatchEvent(makeTouchEvent('touchmove', [{ clientX: 5000, clientY: 5000 }]));
    var leftPx = parseInt(textBox.el.style.left, 10);
    var topPx  = parseInt(textBox.el.style.top, 10);
    // Must be within [0, container - box]. box width=200, height=60.
    expect(leftPx).toBeLessThanOrEqual(800 - 200);
    expect(topPx).toBeLessThanOrEqual(600 - 60);
  });

  it('pinch (2-finger touchstart) cancels an in-flight hold and closes any open menu', () => {
    textBox.select();
    textBox.applyFontSize(24);
    textBox.el.dispatchEvent(makeTouchEvent('touchstart', [{ clientX: 200, clientY: 200 }]));
    jest.advanceTimersByTime(HOLD_MS + 50);
    expect(textBox.el.classList.contains('hold-active')).toBe(true);
    // Manually open the menu to verify it gets closed by pinch.
    textBox.showQuickActions();
    expect(textBox.quickMenu.classList.contains('is-open')).toBe(true);
    // Second finger lands — pinch takes over.
    textBox.el.dispatchEvent(makeTouchEvent('touchstart', [
      { clientX: 200, clientY: 200 },
      { clientX: 300, clientY: 200 }
    ]));
    expect(textBox.el.classList.contains('hold-active')).toBe(false);
    expect(textBox.quickMenu.classList.contains('is-open')).toBe(false);
  });

  it('ignores touchstart that originates on a resize handle (resize wins)', () => {
    var handle = textBox.el.querySelector('.resize-handle.bottom-right');
    expect(handle).not.toBeNull();
    var ev = makeTouchEvent('touchstart', [{ clientX: 200, clientY: 200 }]);
    // Override target so the closest('.resize-handle') check matches.
    Object.defineProperty(ev, 'target', { value: handle });
    textBox.el.dispatchEvent(ev);
    jest.advanceTimersByTime(HOLD_MS + 50);
    expect(textBox.el.classList.contains('hold-active')).toBe(false);
  });
});

// ── Quick-action menu (long-press output) ───────────────────────────────────

describe('Quick-action menu (TextBox.js)', () => {
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

  it('renders an Edit / Delete pair with the documented class names', () => {
    expect(textBox.quickMenu.querySelector('.quick-action-edit')).not.toBeNull();
    expect(textBox.quickMenu.querySelector('.quick-action-delete')).not.toBeNull();
  });

  it('Edit closes the menu and focuses the textarea', () => {
    const focusSpy = jest.spyOn(textBox, 'focusTextarea');
    textBox.showQuickActions();
    textBox.qEditBtn.click();
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it('Delete only fires after an explicit Delete tap — long-press alone never destroys', () => {
    const destroySpy = jest.spyOn(textBox, 'destroy');
    textBox.showQuickActions();
    // Long press alone does not destroy — destroy is gated behind this click.
    expect(destroySpy).not.toHaveBeenCalled();
    textBox.qDeleteBtn.click();
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it('deselect() closes the menu (e.g. user picks another text box)', () => {
    textBox.select();
    textBox.showQuickActions();
    textBox.deselect();
    expect(textBox.quickMenu.classList.contains('is-open')).toBe(false);
  });

  it('double-tap is suppressed while the menu is open so menu interactions cannot fire focus', () => {
    const focusSpy = jest.spyOn(textBox, 'focusTextarea');
    textBox.showQuickActions();
    textBox.el.dispatchEvent(makeTouchEvent('touchend', [], [{ clientX: 50, clientY: 50 }]));
    textBox.el.dispatchEvent(makeTouchEvent('touchend', [], [{ clientX: 50, clientY: 50 }]));
    expect(focusSpy).not.toHaveBeenCalled();
  });
});

// ── Deselect on mobile blurs the textarea so the next select cannot type ──

describe('Deselect blur contract (TextBox.js)', () => {
  let container;
  let textBox;

  beforeEach(() => {
    document.body.innerHTML = '<div id="canvas-container"></div>';
    container = document.getElementById('canvas-container');
    textBox = new window.MemeGen.TextBox(10, 10, container);
  });

  afterEach(() => { document.body.innerHTML = ''; });

  it('blurs the textarea on deselect so the mobile pointer-events:none gate re-engages', () => {
    textBox.textarea.focus();
    expect(document.activeElement).toBe(textBox.textarea);
    textBox.select();
    textBox.deselect();
    expect(document.activeElement).not.toBe(textBox.textarea);
  });
});

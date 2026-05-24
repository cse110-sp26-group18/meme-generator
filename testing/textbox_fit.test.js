/**
 * v1_textbox_fit.test.js
 * Verifies the auto-fit textbox behavior added on feature/fitting-txtbox.
 *
 * The textbox should hug its text content (width + height) as the user types,
 * unless they have manually resized it via a corner handle — in which case the
 * manual sizing wins and auto-fit is disabled for that box.
 *
 * Modules under test: meme-app/js/TextBox.js, meme-app/js/DragResize.js
 * Loaded globally via testing/setup.js.
 */

function makeContainer(w = 800, h = 600) {
  const div = document.createElement('div');
  div.style.position = 'relative';
  Object.defineProperty(div, 'offsetWidth', { get: () => w, configurable: true });
  Object.defineProperty(div, 'offsetHeight', { get: () => h, configurable: true });
  document.body.appendChild(div);
  return div;
}

// ── fitToText() — direct API ──────────────────────────────────────────────────

describe('TextBox.fitToText() — direct sizing', () => {
  let container;
  let textBox;

  beforeEach(() => {
    container = makeContainer();
    textBox = new MemeGen.TextBox(0, 0, container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('collapses near the CSS minimums (80x40) when the textarea is empty', () => {
    textBox.textarea.value = '';
    textBox.fitToText();
    // Width: text width 0 + chrome 16 → 16, floored at 80.
    // Height: one empty line (fontSize*1.2) + chrome 12 ≈ 41 at fontSize 24.
    expect(parseInt(textBox.el.style.width, 10)).toBe(80);
    expect(parseInt(textBox.el.style.height, 10)).toBeLessThanOrEqual(45);
    expect(parseInt(textBox.el.style.height, 10)).toBeGreaterThanOrEqual(40);
  });

  it('produces a wider box for longer single-line text', () => {
    // Use text long enough that both measurements clear the 80px CSS minimum,
    // so the comparison reflects actual text-width sensitivity (not the floor).
    textBox.textarea.value = 'a'.repeat(80);
    textBox.fitToText();
    const shortWidth = parseInt(textBox.el.style.width, 10);

    textBox.textarea.value = 'a'.repeat(200);
    textBox.fitToText();
    const longWidth = parseInt(textBox.el.style.width, 10);

    expect(longWidth).toBeGreaterThan(shortWidth);
  });

  it('produces a taller box for multi-line text', () => {
    textBox.textarea.value = 'one';
    textBox.fitToText();
    const oneLineHeight = parseInt(textBox.el.style.height, 10);

    textBox.textarea.value = 'one\ntwo\nthree';
    textBox.fitToText();
    const threeLineHeight = parseInt(textBox.el.style.height, 10);

    expect(threeLineHeight).toBeGreaterThan(oneLineHeight);
  });

  it('shrinks the box back down when text is deleted', () => {
    textBox.textarea.value = 'a'.repeat(200);
    textBox.fitToText();
    const wideWidth = parseInt(textBox.el.style.width, 10);

    textBox.textarea.value = 'x';
    textBox.fitToText();
    const narrowWidth = parseInt(textBox.el.style.width, 10);

    expect(narrowWidth).toBeLessThan(wideWidth);
  });

  it('grows taller when font size increases for the same text', () => {
    textBox.textarea.value = 'meme text';
    textBox.applyFontSize(16);
    textBox.fitToText();
    const smallHeight = parseInt(textBox.el.style.height, 10);

    textBox.applyFontSize(48);
    textBox.fitToText();
    const bigHeight = parseInt(textBox.el.style.height, 10);

    expect(bigHeight).toBeGreaterThan(smallHeight);
  });
});

// ── Live auto-fit — input event ───────────────────────────────────────────────

describe('TextBox live auto-fit — fires on textarea "input"', () => {
  let container;
  let textBox;

  beforeEach(() => {
    container = makeContainer();
    textBox = new MemeGen.TextBox(0, 0, container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('resizes the box automatically when the textarea fires an input event', () => {
    const initialWidth = parseInt(textBox.el.style.width, 10);

    textBox.textarea.value = 'top text '.repeat(20);
    textBox.textarea.dispatchEvent(new Event('input', { bubbles: true }));

    const afterWidth = parseInt(textBox.el.style.width, 10);
    expect(afterWidth).not.toBe(initialWidth);
    // For a long string the fit width should clear the 80px CSS minimum.
    expect(afterWidth).toBeGreaterThan(80);
  });

  it('does NOT auto-fit after the user has manually corner-resized the box', () => {
    MemeGen.DragResize.attach(textBox);

    // Simulate the user grabbing a corner handle — DragResize sets the
    // manuallyResized flag on mousedown of a .resize-handle.
    const handle = textBox.el.querySelector('.resize-handle.bottom-right');
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));
    // Release immediately — we only care that the flag flipped.
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(textBox.manuallyResized).toBe(true);

    // User-set dimensions
    textBox.el.style.width = '300px';
    textBox.el.style.height = '120px';

    // Now type — box should stay at user-set size, not snap to text content.
    textBox.textarea.value = 'x';
    textBox.textarea.dispatchEvent(new Event('input', { bubbles: true }));

    expect(textBox.el.style.width).toBe('300px');
    expect(textBox.el.style.height).toBe('120px');
  });
});

/**
 * textbox_fit.test.js
 * Verifies the auto-fit textbox behavior on feature/fitting-txtbox.
 *
 * The box is the fixed boundary; the FONT scales to fit inside it. As the user
 * types, the font shrinks so the text never overflows the box (and grows back
 * when there is spare room). Resizing the box rescales the font to match.
 *
 * Note: jest-canvas-mock's measureText().width returns the character count
 * (font-size independent), so these tests drive the fit through line count and
 * box height — the deterministic levers — rather than pixel widths.
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

// ── fitToText() — direct API ───────────────────────────────────────────────

describe('TextBox.fitToText() — font fits the box', () => {
  let container;
  let textBox;

  beforeEach(() => {
    container = makeContainer();
    textBox = new MemeGen.TextBox(0, 0, container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('grows the font when the box gets taller (same text)', () => {
    textBox.el.style.width = '200px';
    textBox.textarea.value = 'hi';

    textBox.el.style.height = '80px';
    textBox.fitToText();
    const smallBoxFont = textBox.fontSize;

    textBox.el.style.height = '300px';
    textBox.fitToText();
    const tallBoxFont = textBox.fontSize;

    expect(tallBoxFont).toBeGreaterThan(smallBoxFont);
  });

  it('shrinks the font when more lines are added to a fixed box', () => {
    textBox.el.style.width = '200px';
    textBox.el.style.height = '150px';

    textBox.textarea.value = 'one';
    textBox.fitToText();
    const fewLinesFont = textBox.fontSize;

    textBox.textarea.value = 'one\ntwo\nthree\nfour\nfive\nsix';
    textBox.fitToText();
    const manyLinesFont = textBox.fontSize;

    expect(manyLinesFont).toBeLessThan(fewLinesFont);
  });

  it('never lets the text overflow the box height', () => {
    textBox.el.style.width = '200px';
    textBox.el.style.height = '120px';
    textBox.textarea.value = 'a\nb\nc\nd\ne'; // 5 short lines, no width wrapping

    textBox.fitToText();

    const innerHeight = 120 - 12;          // vertical chrome
    const usedHeight = 5 * textBox.fontSize * 1.2;
    expect(usedHeight).toBeLessThanOrEqual(innerHeight);
  });

  it('floors at the minimum font size (8px) for an impossible amount of text', () => {
    textBox.el.style.width = '120px';
    textBox.el.style.height = '40px';
    textBox.textarea.value = Array(40).fill('x').join('\n'); // 40 lines, tiny box

    textBox.fitToText();

    expect(textBox.fontSize).toBe(8);
  });

  it('caps at the maximum font size (120px) when the box is huge and text is tiny', () => {
    textBox.el.style.width = '2000px';
    textBox.el.style.height = '2000px';
    textBox.textarea.value = 'a';

    textBox.fitToText();

    expect(textBox.fontSize).toBe(120);
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

  it('shrinks the font (not the box) when typing would overflow', () => {
    textBox.el.style.width = '200px';
    textBox.el.style.height = '200px';
    const initialFont = textBox.fontSize;
    const widthBefore = textBox.el.style.width;
    const heightBefore = textBox.el.style.height;

    textBox.textarea.value = Array(10).fill('x').join('\n'); // 10 lines overflow
    textBox.textarea.dispatchEvent(new Event('input', { bubbles: true }));

    // Box dimensions are untouched — only the font changes.
    expect(textBox.el.style.width).toBe(widthBefore);
    expect(textBox.el.style.height).toBe(heightBefore);
    expect(textBox.fontSize).toBeLessThan(initialFont);
  });
});

// ── Resize rescales the font — through the real drag handler ───────────────────

describe('DragResize — resizing the box rescales the font', () => {
  let container;
  let textBox;

  beforeEach(() => {
    container = makeContainer();
    textBox = new MemeGen.TextBox(0, 0, container);
    MemeGen.DragResize.attach(textBox);
    textBox.textarea.value = 'hello';

    // jsdom has no layout; mirror style dimensions onto offset* like the
    // customization suite so the drag math has real start sizes to work from.
    Object.defineProperty(textBox.el, 'offsetWidth', {
      get: () => parseInt(textBox.el.style.width) || 200,
      configurable: true
    });
    Object.defineProperty(textBox.el, 'offsetHeight', {
      get: () => parseInt(textBox.el.style.height) || 60,
      configurable: true
    });
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  function dragBottomRight(dx, dy) {
    const handle = textBox.el.querySelector('.resize-handle.bottom-right');
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: dx, clientY: dy }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }

  it('uses a larger font for a larger box and a smaller font for a smaller box', () => {
    dragBottomRight(200, 300); // grow: 200×60 → 400×360
    const bigFont = textBox.fontSize;

    dragBottomRight(-100, -300); // shrink: 400×360 → 300×60
    const smallFont = textBox.fontSize;

    expect(bigFont).toBeGreaterThan(smallFont);
  });
});

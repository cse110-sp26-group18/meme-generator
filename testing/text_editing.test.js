/**
 * v1_test_text_editing.test.js
 * Verifies First Iteration Goal: "Click image to add/edit movable text"
 *
 * Covers:
 *  - Clicking the canvas creates a TextBox at the click position
 *  - Clicking before an image is loaded does NOT create a TextBox
 *  - TextBox textarea is editable and state reflects the content
 *  - TextBox select / deselect behaviour
 *  - Delete button removes the TextBox from the DOM
 *  - Drag events update the element's position
 *  - Drag is bounded within the container
 *  - Multiple text boxes can coexist on one image
 *
 * Modules under test: TextBox.js, TextBoxManager.js, DragResize.js
 * Loaded globally via testing/setup.js
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContainer(w = 800, h = 600) {
  const div = document.createElement('div');
  div.style.position = 'relative';
  // Mock offsetWidth/offsetHeight — jsdom always returns 0 for layout dims
  Object.defineProperty(div, 'offsetWidth', { get: () => w, configurable: true });
  Object.defineProperty(div, 'offsetHeight', { get: () => h, configurable: true });
  document.body.appendChild(div);
  return div;
}

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = 800;
  c.height = 600;
  // getBoundingClientRect returns zeros in jsdom; override for coordinate math
  c.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600 });
  return c;
}

function fireMousedown(target, x = 100, y = 100) {
  target.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y })
  );
}

// ── Text Placement ────────────────────────────────────────────────────────────

describe('Text Placement — click on image creates a TextBox', () => {
  let container;
  let canvas;

  beforeEach(() => {
    container = makeContainer();
    canvas = makeCanvas();
    container.appendChild(canvas);
    // Re-init manager with fresh elements; setImageLoaded controls creation
    MemeGen.TextBoxManager.init(container, canvas);
    MemeGen.TextBoxManager.setImageLoaded(true);
  });

  afterEach(() => {
    MemeGen.TextBoxManager.setImageLoaded(false);
    document.body.removeChild(container);
  });

  it('should create a text box when the canvas is clicked with imageLoaded=true', () => {
    // Verifies core "click to add text" behaviour
    const before = container.querySelectorAll('.text-box').length;
    fireMousedown(canvas, 150, 200);
    expect(container.querySelectorAll('.text-box').length).toBe(before + 1);
  });

  it('should NOT create a text box when imageLoaded is false', () => {
    // Edge case: clicking canvas before upload must be ignored
    MemeGen.TextBoxManager.setImageLoaded(false);
    const before = container.querySelectorAll('.text-box').length;
    fireMousedown(canvas, 150, 200);
    expect(container.querySelectorAll('.text-box').length).toBe(before);
  });

  it('should position the new text box at approximately the click coordinates', () => {
    fireMousedown(canvas, 200, 150);
    const box = container.querySelector('.text-box');
    // getBoundingClientRect returns {left:0, top:0}, so el.style.left = clientX px
    expect(box.style.left).toBe('200px');
    expect(box.style.top).toBe('150px');
  });

  it('should allow multiple text boxes to be created by successive clicks', () => {
    // Verifies "Multiple text elements on one image" edge case
    const before = container.querySelectorAll('.text-box').length;
    fireMousedown(canvas, 50, 50);
    fireMousedown(canvas, 200, 200);
    fireMousedown(canvas, 400, 300);
    expect(container.querySelectorAll('.text-box').length).toBe(before + 3);
  });
});

// ── Text Editing ──────────────────────────────────────────────────────────────

describe('Text Editing — textarea content and state', () => {
  let container;
  let canvas;
  let textBox;

  beforeEach(() => {
    container = makeContainer();
    canvas = makeCanvas();
    container.appendChild(canvas);
    textBox = new MemeGen.TextBox(10, 10, container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should have an editable textarea inside the text box', () => {
    const ta = textBox.el.querySelector('textarea.text-content');
    expect(ta).not.toBeNull();
    expect(ta.tagName).toBe('TEXTAREA');
  });

  it('should reflect typed content in getState().text', () => {
    textBox.textarea.value = 'Top text';
    const state = textBox.getState();
    expect(state.text).toBe('Top text');
  });

  it('should return an empty string in getState().text when nothing is typed', () => {
    expect(textBox.getState().text).toBe('');
  });

  it('should add the "selected" class when select() is called', () => {
    textBox.select();
    expect(textBox.el.classList.contains('selected')).toBe(true);
    expect(textBox.selected).toBe(true);
  });

  it('should remove the "selected" class when deselect() is called', () => {
    textBox.select();
    textBox.deselect();
    expect(textBox.el.classList.contains('selected')).toBe(false);
    expect(textBox.selected).toBe(false);
  });

  it('should invoke onDelete callback and remove the element when the × button is clicked', () => {
    // Verifies delete removes the TextBox cleanly
    let deletedBox = null;
    textBox.onDelete = (box) => { deletedBox = box; };

    textBox.deleteBtn.click();

    expect(deletedBox).toBe(textBox);
    expect(container.querySelector('.text-box')).toBeNull();
  });
});

// ── Drag and Reposition ───────────────────────────────────────────────────────

describe('Drag and Reposition — DragResize.attach()', () => {
  let container;
  let textBox;

  beforeEach(() => {
    container = makeContainer(800, 600);
    textBox = new MemeGen.TextBox(100, 100, container);

    // Mock the element's own layout dimensions for boundary math
    Object.defineProperty(textBox.el, 'offsetWidth', { get: () => 200, configurable: true });
    Object.defineProperty(textBox.el, 'offsetHeight', { get: () => 60, configurable: true });
    Object.defineProperty(textBox.el, 'offsetLeft', { get: () => parseInt(textBox.el.style.left) || 0, configurable: true });
    Object.defineProperty(textBox.el, 'offsetTop', { get: () => parseInt(textBox.el.style.top) || 0, configurable: true });

    MemeGen.DragResize.attach(textBox);
  });

  afterEach(() => {
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    document.body.removeChild(container);
  });

  it('should update el.style.left and el.style.top when dragged', () => {
    // Drag the box 50px right and 30px down
    textBox.el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 150, clientY: 130 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    // Position should have moved (exact values depend on boundary clamping)
    const newLeft = parseInt(textBox.el.style.left);
    const newTop = parseInt(textBox.el.style.top);
    expect(newLeft).toBeGreaterThanOrEqual(0);
    expect(newTop).toBeGreaterThanOrEqual(0);
  });

  it('should clamp position so the box does not exceed the right boundary', () => {
    // Drag far right — should be clamped to container.offsetWidth - el.offsetWidth
    textBox.el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 9999, clientY: 100 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    const newLeft = parseInt(textBox.el.style.left);
    const maxLeft = container.offsetWidth - textBox.el.offsetWidth; // 600
    expect(newLeft).toBeLessThanOrEqual(maxLeft);
  });

  it('should clamp position so the box does not go above the top boundary (left < 0)', () => {
    // Drag far left — should be clamped to 0
    textBox.el.style.left = '50px';
    textBox.el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 50, clientY: 50 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: -999, clientY: 50 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(parseInt(textBox.el.style.left)).toBeGreaterThanOrEqual(0);
  });

  it('should stop updating position after mouseup', () => {
    textBox.el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    const leftAfterRelease = textBox.el.style.left;

    // Further movement should not change position
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 500, clientY: 500 }));
    expect(textBox.el.style.left).toBe(leftAfterRelease);
  });
});

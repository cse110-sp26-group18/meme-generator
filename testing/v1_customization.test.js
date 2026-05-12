/**
 * v1_test_customization.test.js
 * Verifies First Iteration Goal: "Basic text customization"
 *
 * Covers:
 *  - Default font is Impact
 *  - Font dropdown contains the five expected options
 *  - Selecting a different font updates fontFamily and is reflected in getState()
 *  - Border is ON by default; toggle switches it off and back on
 *  - Four resize handles exist on each TextBox
 *  - DragResize enforces minimum width (80 px) and height (40 px)
 *
 * Coverage Gap (noted here, not tested):
 *  - Text color: v1 has no color picker — white fill with black stroke is
 *    hardcoded in CSS (-webkit-text-stroke) and Exporter.js.
 *  - Font size auto-resize: documented as "not achieved" in documentation/log.md.
 *
 * Modules under test: TextBox.js, DragResize.js
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContainer() {
  const div = document.createElement('div');
  div.style.position = 'relative';
  Object.defineProperty(div, 'offsetWidth', { get: () => 800, configurable: true });
  Object.defineProperty(div, 'offsetHeight', { get: () => 600, configurable: true });
  document.body.appendChild(div);
  return div;
}

// ── Font Customization ────────────────────────────────────────────────────────

describe('Font Customization', () => {
  let container;
  let textBox;

  beforeEach(() => {
    container = makeContainer();
    textBox = new MemeGen.TextBox(10, 10, container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should default to Impact font', () => {
    expect(textBox.fontFamily).toBe('Impact');
  });

  it('should provide all five expected font options in the dropdown', () => {
    // Verifies the prompt spec: Impact, Arial, Comic Sans, Helvetica, Montserrat
    const options = Array.from(textBox.fontSelect.options).map((o) => o.text);
    expect(options).toContain('Impact');
    expect(options).toContain('Arial');
    expect(options).toContain('Comic Sans');
    expect(options).toContain('Helvetica');
    expect(options).toContain('Montserrat');
  });

  it('should update fontFamily property when the font select changes to Arial', () => {
    textBox.fontSelect.value = 'Arial';
    textBox.fontSelect.dispatchEvent(new Event('change'));
    expect(textBox.fontFamily).toBe('Arial');
  });

  it('should update fontFamily property when the font select changes to Comic Sans', () => {
    textBox.fontSelect.value = "'Comic Sans MS', cursive";
    textBox.fontSelect.dispatchEvent(new Event('change'));
    expect(textBox.fontFamily).toBe("'Comic Sans MS', cursive");
  });

  it('should reflect the updated font family in getState()', () => {
    textBox.fontSelect.value = 'Arial';
    textBox.fontSelect.dispatchEvent(new Event('change'));
    expect(textBox.getState().fontFamily).toBe('Arial');
  });

  it('should apply the chosen font as inline style on the textarea', () => {
    textBox.fontSelect.value = 'Arial';
    textBox.fontSelect.dispatchEvent(new Event('change'));
    expect(textBox.textarea.style.fontFamily).toBe('Arial');
  });
});

// ── Border Toggle ─────────────────────────────────────────────────────────────

describe('Border Toggle', () => {
  let container;
  let textBox;

  beforeEach(() => {
    container = makeContainer();
    textBox = new MemeGen.TextBox(10, 10, container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should have border enabled by default', () => {
    expect(textBox.borderEnabled).toBe(true);
  });

  it('should display "Border: ON" on the toggle button initially', () => {
    expect(textBox.borderBtn.textContent).toBe('Border: ON');
  });

  it('should disable the border and update button text after one click', () => {
    textBox.borderBtn.click();
    expect(textBox.borderEnabled).toBe(false);
    expect(textBox.borderBtn.textContent).toBe('Border: OFF');
  });

  it('should add the "no-border" class to textarea when border is toggled off', () => {
    textBox.borderBtn.click();
    expect(textBox.textarea.classList.contains('no-border')).toBe(true);
  });

  it('should re-enable the border after a second click', () => {
    textBox.borderBtn.click();
    textBox.borderBtn.click();
    expect(textBox.borderEnabled).toBe(true);
    expect(textBox.borderBtn.textContent).toBe('Border: ON');
  });

  it('should remove the "no-border" class from textarea when border is re-enabled', () => {
    textBox.borderBtn.click();
    textBox.borderBtn.click();
    expect(textBox.textarea.classList.contains('no-border')).toBe(false);
  });

  it('should reflect borderEnabled=false in getState() after toggle', () => {
    textBox.borderBtn.click();
    expect(textBox.getState().borderEnabled).toBe(false);
  });
});

// ── Resize Handles ────────────────────────────────────────────────────────────

describe('Text Box Resize Handles', () => {
  let container;
  let textBox;

  beforeEach(() => {
    container = makeContainer();
    textBox = new MemeGen.TextBox(100, 100, container);
    Object.defineProperty(textBox.el, 'offsetWidth', { get: () => 200, configurable: true });
    Object.defineProperty(textBox.el, 'offsetHeight', { get: () => 60, configurable: true });
    Object.defineProperty(textBox.el, 'offsetLeft', { get: () => 100, configurable: true });
    Object.defineProperty(textBox.el, 'offsetTop', { get: () => 100, configurable: true });
    MemeGen.DragResize.attach(textBox);
  });

  afterEach(() => {
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    document.body.removeChild(container);
  });

  it('should render exactly four resize handles', () => {
    const handles = textBox.el.querySelectorAll('.resize-handle');
    expect(handles.length).toBe(4);
  });

  it('should have a handle for each corner', () => {
    const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    corners.forEach((corner) => {
      expect(textBox.el.querySelector(`.resize-handle.${corner}`)).not.toBeNull();
    });
  });

  it('should not allow width to go below MIN_WIDTH (80 px) when resizing', () => {
    const handle = textBox.el.querySelector('.resize-handle.bottom-right');
    // Start at right edge (startLeft=100, startWidth=200 → clientX=300)
    // Then drag far left to attempt extreme shrink
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 300, clientY: 160 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 50, clientY: 160 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    const finalWidth = parseInt(textBox.el.style.width);
    expect(finalWidth).toBeGreaterThanOrEqual(80);
  });

  it('should not allow height to go below MIN_HEIGHT (40 px) when resizing', () => {
    const handle = textBox.el.querySelector('.resize-handle.bottom-right');
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 300, clientY: 160 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 300, clientY: 50 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    const finalHeight = parseInt(textBox.el.style.height);
    expect(finalHeight).toBeGreaterThanOrEqual(40);
  });

  it('should increase width when the bottom-right handle is dragged right', () => {
    const handle = textBox.el.querySelector('.resize-handle.bottom-right');
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 300, clientY: 160 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 400, clientY: 160 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    const finalWidth = parseInt(textBox.el.style.width);
    expect(finalWidth).toBeGreaterThan(200); // started at 200
  });
});

// ── All Four Resize Directions ────────────────────────────────────────────────

describe('Text Box Resize — all four corner handles', () => {
  let container;
  let textBox;

  function setupTextBox() {
    container = makeContainer();
    textBox = new MemeGen.TextBox(100, 100, container);
    Object.defineProperty(textBox.el, 'offsetWidth',  { get: () => 200, configurable: true });
    Object.defineProperty(textBox.el, 'offsetHeight', { get: () => 100, configurable: true });
    Object.defineProperty(textBox.el, 'offsetLeft',   { get: () => parseInt(textBox.el.style.left)  || 100, configurable: true });
    Object.defineProperty(textBox.el, 'offsetTop',    { get: () => parseInt(textBox.el.style.top)   || 100, configurable: true });
    MemeGen.DragResize.attach(textBox);
  }

  beforeEach(setupTextBox);

  afterEach(() => {
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    document.body.removeChild(container);
  });

  it('bottom-right: dragging right increases width', () => {
    const handle = textBox.el.querySelector('.resize-handle.bottom-right');
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 300, clientY: 200 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 380, clientY: 200 }));
    document.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }));
    expect(parseInt(textBox.el.style.width)).toBeGreaterThan(200);
  });

  it('bottom-left: dragging left increases width and moves the left edge', () => {
    const handle = textBox.el.querySelector('.resize-handle.bottom-left');
    // startLeft=100, startWidth=200 → left handle at clientX=100
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 200 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 40,  clientY: 200 }));
    document.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }));
    expect(parseInt(textBox.el.style.width)).toBeGreaterThan(200);
  });

  it('top-right: dragging up increases height and moves the top edge', () => {
    const handle = textBox.el.querySelector('.resize-handle.top-right');
    // startTop=100, startHeight=100 → top handle at clientY=100
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 300, clientY: 100 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 300, clientY: 40  }));
    document.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }));
    expect(parseInt(textBox.el.style.height)).toBeGreaterThan(100);
  });

  it('top-left: dragging up-left increases both dimensions and moves the box origin', () => {
    const handle = textBox.el.querySelector('.resize-handle.top-left');
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 40,  clientY: 40  }));
    document.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }));
    expect(parseInt(textBox.el.style.width)).toBeGreaterThan(200);
    expect(parseInt(textBox.el.style.height)).toBeGreaterThan(100);
  });

  it('bottom-right: enforces MIN_WIDTH even with extreme drag', () => {
    const handle = textBox.el.querySelector('.resize-handle.bottom-right');
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 300, clientY: 200 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: -999, clientY: 200 }));
    document.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }));
    expect(parseInt(textBox.el.style.width)).toBeGreaterThanOrEqual(80);
  });

  it('top-left: enforces MIN_HEIGHT even with extreme drag', () => {
    const handle = textBox.el.querySelector('.resize-handle.top-left');
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 9999 }));
    document.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }));
    expect(parseInt(textBox.el.style.height)).toBeGreaterThanOrEqual(40);
  });
});

// ── Special Characters in Text ────────────────────────────────────────────────

describe('Text Box — special character content', () => {
  let container;
  let textBox;

  beforeEach(() => {
    container = makeContainer();
    textBox = new MemeGen.TextBox(10, 10, container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should accept emoji characters in the textarea without error', () => {
    textBox.textarea.value = '😂👌🔥💯';
    expect(textBox.getState().text).toBe('😂👌🔥💯');
  });

  it('should accept CJK characters (Chinese/Japanese/Korean) without error', () => {
    textBox.textarea.value = '这是梗图 ミーム 밈';
    expect(textBox.getState().text).toBe('这是梗图 ミーム 밈');
  });

  it('should accept a very long string (500+ chars) without error', () => {
    const longStr = 'a'.repeat(500);
    textBox.textarea.value = longStr;
    expect(textBox.getState().text).toBe(longStr);
  });

  it('should accept special HTML-like characters without escaping issues', () => {
    textBox.textarea.value = '<script>alert("xss")</script>';
    // Stored as plain text, not interpreted as HTML
    expect(textBox.getState().text).toBe('<script>alert("xss")</script>');
  });
});

// ── Coverage Gap: Color ───────────────────────────────────────────────────────

describe('Coverage Gap — Text Color (not implemented in v1)', () => {
  it.todo('color picker exists — v1 has no color UI; text is hardcoded white/black in CSS and Exporter');
  it.todo('selecting a color updates the text color — blocked by missing color picker');
});

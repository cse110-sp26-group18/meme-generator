/**
 * TextBoxManager.loadDetectedBoxes.test.js
 * Verifies that loadDetectedBoxes maps OCR regions to DOM text boxes
 * with correct scaling, content, and erase behaviour.
 *
 * Module under test: meme-app/js/TextBoxManager.js
 * Loaded globally via testing/setup.js
 */

const mockRegions = [
  { text: 'HELLO', x: 10, y: 20, width: 100, height: 40, confidence: 90 },
  { text: 'WORLD', x: 50, y: 80, width: 120, height: 40, confidence: 85 }
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContainer() {
  const div = document.createElement('div');
  div.style.position = 'relative';
  document.body.appendChild(div);
  return div;
}

function makeCanvas() {
  const c = document.createElement('canvas');
  // canvas.width / canvas.height — intrinsic pixel dimensions read by loadDetectedBoxes
  c.width  = 800;
  c.height = 600;
  // canvas.offsetWidth / canvas.offsetHeight — CSS layout dims; jsdom always returns 0
  Object.defineProperty(c, 'offsetWidth',  { get: () => 400, configurable: true });
  Object.defineProperty(c, 'offsetHeight', { get: () => 300, configurable: true });
  // scaleX = 400/800 = 0.5,  scaleY = 300/600 = 0.5
  return c;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TextBoxManager.loadDetectedBoxes', () => {
  let container;
  let canvas;
  let mockCtx;

  beforeEach(() => {
    // Drain boxes left over from any preceding test or test file so that
    // getAll().length is exactly 0 at the start of every test.
    MemeGen.TextBoxManager.getAll().slice().forEach(tb => tb.destroy());

    container = makeContainer();
    canvas    = makeCanvas();
    container.appendChild(canvas);

    // Provide a controlled 2D context so getImageData and fillRect are
    // observable — jest-canvas-mock is active but we shadow it on the instance.
    mockCtx = {
      getImageData: jest.fn((x, y, w) => ({ data: new Uint8Array(w * 4).fill(0) })),
      fillRect:     jest.fn(),
      fillStyle:    ''
    };
    canvas.getContext = jest.fn(() => mockCtx);

    MemeGen.TextBoxManager.init(container, canvas);
  });

  afterEach(() => {
    MemeGen.TextBoxManager.getAll().slice().forEach(tb => tb.destroy());
    document.body.removeChild(container);
    jest.restoreAllMocks();
  });

  test('creates a DOM .text-box element for each region', () => {
    MemeGen.TextBoxManager.loadDetectedBoxes(mockRegions);
    expect(container.querySelectorAll('.text-box').length).toBe(2);
  });

  test('sets each textarea value to the corresponding region text', () => {
    MemeGen.TextBoxManager.loadDetectedBoxes(mockRegions);
    const textareas = Array.from(container.querySelectorAll('.text-box textarea'));
    expect(textareas[0].value).toBe('HELLO');
    expect(textareas[1].value).toBe('WORLD');
  });

  test('positions each box at region coordinates scaled by 0.5', () => {
    MemeGen.TextBoxManager.loadDetectedBoxes(mockRegions);
    const boxes = container.querySelectorAll('.text-box');
    // region[0]: x=10→5px, y=20→10px
    expect(boxes[0].style.left).toBe('5px');
    expect(boxes[0].style.top).toBe('10px');
    // region[1]: x=50→25px, y=80→40px
    expect(boxes[1].style.left).toBe('25px');
    expect(boxes[1].style.top).toBe('40px');
  });

  test('getAll() returns 2 items after the call', () => {
    MemeGen.TextBoxManager.loadDetectedBoxes(mockRegions);
    expect(MemeGen.TextBoxManager.getAll().length).toBe(2);
  });

  test('clicking the erase button calls ctx.fillRect with original unscaled region coordinates', () => {
    MemeGen.TextBoxManager.loadDetectedBoxes(mockRegions);
    const boxes = MemeGen.TextBoxManager.getAll();

    boxes[0].eraseBtn.click();

    expect(mockCtx.fillRect).toHaveBeenCalledWith(
      mockRegions[0].x,
      mockRegions[0].y,
      mockRegions[0].width,
      mockRegions[0].height
    );
  });
});

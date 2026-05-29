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
    // coverRegions is module-level state; erased covers outlive their boxes, so
    // truncate the live array to start each test from a clean slate.
    MemeGen.TextBoxManager.getCoverRegions().length = 0;

    container = makeContainer();
    canvas    = makeCanvas();
    container.appendChild(canvas);

    // Provide a controlled 2D context so getImageData and fillRect are
    // observable — jest-canvas-mock is active but we shadow it on the instance.
    mockCtx = {
      getImageData:    jest.fn((x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4).fill(0) })),
      createImageData: jest.fn((w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h })),
      putImageData:    jest.fn(),
      fillRect:        jest.fn(),
      drawImage:       jest.fn(),
      clearRect:       jest.fn(),
      fillStyle:       ''
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

  test('keeps short numeric labels (e.g. "2%") but drops stray single letters', () => {
    MemeGen.TextBoxManager.loadDetectedBoxes([
      { text: '2%',   x: 10, y: 10, width: 40, height: 30, confidence: 80 },
      { text: '0.1%', x: 60, y: 10, width: 60, height: 30, confidence: 80 },
      { text: '55',   x: 10, y: 50, width: 40, height: 30, confidence: 80 },
      { text: 'I',    x: 60, y: 50, width: 20, height: 30, confidence: 80 }
    ]);
    const values = Array.from(container.querySelectorAll('.text-box textarea')).map(t => t.value);
    expect(values).toEqual(['2%', '0.1%', '55']); // 'I' (no digit, <3 alnum) dropped
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

  test('clears the min-width/height floor so boxes hug the detected text', () => {
    MemeGen.TextBoxManager.loadDetectedBoxes([
      { text: '2%', x: 10, y: 10, width: 24, height: 14, confidence: 80 }
    ]);
    const box = container.querySelector('.text-box');
    // 24 * scaleX(0.5) = 12px; without the floor reset it would render at 80px.
    expect(box.style.minWidth).toBe('0px');
    expect(box.style.minHeight).toBe('0px');
    expect(box.style.width).toBe('12px');
  });

  test('records a non-destructive cover region per box at unscaled coordinates', () => {
    MemeGen.TextBoxManager.loadDetectedBoxes(mockRegions);
    const covers = MemeGen.TextBoxManager.getCoverRegions();

    expect(covers).toHaveLength(2);
    expect(covers[0]).toMatchObject({ x: 10, y: 20, width: 100, height: 40 });
    expect(covers[1]).toMatchObject({ x: 50, y: 80, width: 120, height: 40 });
    // The original image is never mutated — no destructive solid fill.
    expect(mockCtx.fillRect).not.toHaveBeenCalled();
  });

  test('applies covers via Inpaint.coverRegion (putImageData) on load', () => {
    MemeGen.TextBoxManager.loadDetectedBoxes(mockRegions);
    expect(mockCtx.putImageData).toHaveBeenCalled();
  });

  test('deleting a box removes its cover (restores original pixels)', () => {
    MemeGen.TextBoxManager.loadDetectedBoxes(mockRegions);
    const boxes = MemeGen.TextBoxManager.getAll();

    boxes[0].deleteBtn.click();

    const covers = MemeGen.TextBoxManager.getCoverRegions();
    expect(covers).toHaveLength(1);
    expect(covers[0]).toMatchObject({ x: 50, y: 80 });
  });

  test('erasing a box keeps its cover even after the box is destroyed', () => {
    MemeGen.TextBoxManager.loadDetectedBoxes(mockRegions);
    const boxes = MemeGen.TextBoxManager.getAll();

    boxes[0].eraseBtn.click();

    // Box gone, but its cover remains so the text stays erased from the image.
    expect(MemeGen.TextBoxManager.getAll()).toHaveLength(1);
    expect(MemeGen.TextBoxManager.getCoverRegions()).toHaveLength(2);
  });
});

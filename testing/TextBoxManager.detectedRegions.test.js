/**
 * TextBoxManager.detectedRegions.test.js
 * Verifies the two-step OCR flow:
 *   1. showDetectedRegions() draws clickable dashed markers over detected text
 *      WITHOUT mutating the image or creating text boxes.
 *   2. Clicking a marker converts that one region into an editable text box and
 *      covers the original pixels (createBoxFromRegion).
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
  // canvas.width / canvas.height — intrinsic pixel dimensions read by the manager
  c.width  = 800;
  c.height = 600;
  // canvas.offsetWidth / canvas.offsetHeight — CSS layout dims; jsdom returns 0
  Object.defineProperty(c, 'offsetWidth',  { get: () => 400, configurable: true });
  Object.defineProperty(c, 'offsetHeight', { get: () => 300, configurable: true });
  // scaleX = 400/800 = 0.5,  scaleY = 300/600 = 0.5
  return c;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TextBoxManager — detected region markers', () => {
  let container;
  let canvas;
  let mockCtx;

  beforeEach(() => {
    // Drain boxes and markers left over from any preceding test/file.
    MemeGen.TextBoxManager.getAll().slice().forEach(tb => tb.destroy());
    MemeGen.TextBoxManager.getCoverRegions().length = 0;
    MemeGen.TextBoxManager.clearDetectedRegions();

    container = makeContainer();
    canvas    = makeCanvas();
    container.appendChild(canvas);

    // Controlled 2D context so getImageData / putImageData / fillRect are
    // observable — jest-canvas-mock is active but we shadow it on the instance.
    mockCtx = {
      canvas:          { width: 800, height: 600 },
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
    MemeGen.TextBoxManager.clearDetectedRegions();
    document.body.removeChild(container);
    jest.restoreAllMocks();
  });

  // ── showDetectedRegions: markers only, no mutation ──────────────────────────

  test('creates one .ocr-region-marker per region and no text boxes yet', () => {
    MemeGen.TextBoxManager.showDetectedRegions(mockRegions);
    expect(container.querySelectorAll('.ocr-region-marker').length).toBe(2);
    expect(container.querySelectorAll('.text-box').length).toBe(0);
  });

  test('does not mutate the image (no cover applied) before a marker is clicked', () => {
    MemeGen.TextBoxManager.showDetectedRegions(mockRegions);
    expect(MemeGen.TextBoxManager.getCoverRegions()).toHaveLength(0);
    expect(mockCtx.putImageData).not.toHaveBeenCalled();
  });

  test('positions each marker at region coordinates scaled by 0.5', () => {
    MemeGen.TextBoxManager.showDetectedRegions(mockRegions);
    const markers = container.querySelectorAll('.ocr-region-marker');
    // region[0]: x=10→5px, y=20→10px, w=100→50px, h=40→20px
    expect(markers[0].style.left).toBe('5px');
    expect(markers[0].style.top).toBe('10px');
    expect(markers[0].style.width).toBe('50px');
    expect(markers[0].style.height).toBe('20px');
  });

  test('keeps short numeric labels (e.g. "2%") but drops stray single letters', () => {
    MemeGen.TextBoxManager.showDetectedRegions([
      { text: '2%',   x: 10, y: 10, width: 40, height: 30, confidence: 80 },
      { text: '0.1%', x: 60, y: 10, width: 60, height: 30, confidence: 80 },
      { text: '55',   x: 10, y: 50, width: 40, height: 30, confidence: 80 },
      { text: 'I',    x: 60, y: 50, width: 20, height: 30, confidence: 80 }
    ]);
    // 'I' (no digit, <3 alnum) is dropped → 3 markers.
    expect(container.querySelectorAll('.ocr-region-marker').length).toBe(3);
  });

  test('a second showDetectedRegions call supersedes the prior markers', () => {
    MemeGen.TextBoxManager.showDetectedRegions(mockRegions);
    MemeGen.TextBoxManager.showDetectedRegions([mockRegions[0]]);
    expect(container.querySelectorAll('.ocr-region-marker').length).toBe(1);
  });

  test('clearDetectedRegions removes all markers', () => {
    MemeGen.TextBoxManager.showDetectedRegions(mockRegions);
    MemeGen.TextBoxManager.clearDetectedRegions();
    expect(container.querySelectorAll('.ocr-region-marker').length).toBe(0);
  });

  // ── Clicking a marker: deferred mutation ────────────────────────────────────

  test('clicking a marker creates a text box with the region text and removes the marker', () => {
    MemeGen.TextBoxManager.showDetectedRegions(mockRegions);
    const marker = container.querySelector('.ocr-region-marker');
    marker.dispatchEvent(new Event('click', { bubbles: true }));

    expect(container.querySelectorAll('.ocr-region-marker').length).toBe(1); // one consumed
    const boxes = container.querySelectorAll('.text-box');
    expect(boxes.length).toBe(1);
    expect(boxes[0].querySelector('textarea').value).toBe('HELLO');
  });

  test('clicking a marker records a non-destructive cover and applies it via Inpaint', () => {
    MemeGen.TextBoxManager.showDetectedRegions(mockRegions);
    const marker = container.querySelector('.ocr-region-marker');
    marker.dispatchEvent(new Event('click', { bubbles: true }));

    const covers = MemeGen.TextBoxManager.getCoverRegions();
    expect(covers).toHaveLength(1);
    expect(covers[0]).toMatchObject({ x: 10, y: 20, width: 100, height: 40 });
    expect(mockCtx.putImageData).toHaveBeenCalled();   // inpaint blend, not a solid fill
    expect(mockCtx.fillRect).not.toHaveBeenCalled();   // image never destructively mutated
  });

  test('deleting a clicked-into box removes its cover (restores original pixels)', () => {
    MemeGen.TextBoxManager.showDetectedRegions(mockRegions);
    container.querySelector('.ocr-region-marker').dispatchEvent(new Event('click', { bubbles: true }));

    const box = MemeGen.TextBoxManager.getAll()[0];
    box.deleteBtn.click();

    expect(MemeGen.TextBoxManager.getCoverRegions()).toHaveLength(0);
  });

  test('deleting a clicked-into box re-shows its marker, and it is clickable again', () => {
    MemeGen.TextBoxManager.showDetectedRegions(mockRegions);
    container.querySelector('.ocr-region-marker').dispatchEvent(new Event('click', { bubbles: true }));
    // One marker consumed by the click; one box created.
    expect(container.querySelectorAll('.ocr-region-marker').length).toBe(1);
    expect(MemeGen.TextBoxManager.getAll().length).toBe(1);

    // Delete the box → its marker should come back (2 markers again, 0 boxes).
    MemeGen.TextBoxManager.getAll()[0].deleteBtn.click();
    expect(container.querySelectorAll('.ocr-region-marker').length).toBe(2);
    expect(MemeGen.TextBoxManager.getAll().length).toBe(0);

    // The restored marker is clickable again → re-creates the box.
    const restored = Array.from(container.querySelectorAll('.ocr-region-marker'))
      .find((m) => m.style.left === '5px'); // region[0] x=10→5px
    restored.dispatchEvent(new Event('click', { bubbles: true }));
    const boxes = container.querySelectorAll('.text-box');
    expect(boxes.length).toBe(1);
    expect(boxes[0].querySelector('textarea').value).toBe('HELLO');
  });
});

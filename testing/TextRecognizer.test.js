/**
 * TextRecognizer.test.js
 * Verifies Phase 1 OCR layer: line-level region detection via Tesseract.js.
 *
 * Tesseract is loaded globally at runtime via a CDN <script> in index.html.
 * In jest we stub `global.Tesseract` per test for isolation.
 *
 * Module under test: meme-app/js/TextRecognizer.js
 * Loaded globally via testing/setup.js
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLine(text, x0, y0, x1, y1, confidence) {
  return { text: text, bbox: { x0: x0, y0: y0, x1: x1, y1: y1 }, confidence: confidence };
}

function makeWord(text, x0, y0, x1, y1) {
  return { text: text, bbox: { x0: x0, y0: y0, x1: x1, y1: y1 } };
}

function stubTesseract(impl) {
  global.Tesseract = { recognize: jest.fn(impl) };
  window.Tesseract = global.Tesseract;
}

function clearTesseract() {
  delete global.Tesseract;
  delete window.Tesseract;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TextRecognizer.detectText', () => {
  let canvas;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    // Long edge ≥ OCR_TARGET_LONG_EDGE (2000) so preprocess uses scale = 1 and
    // these tests can assert raw, un-remapped coordinates.
    canvas.width = 2000;
    canvas.height = 1500;
  });

  afterEach(() => {
    clearTesseract();
    jest.restoreAllMocks();
  });

  test('maps Tesseract lines[] to the documented Region shape', async () => {
    stubTesseract(() => Promise.resolve({
      data: {
        lines: [
          makeLine('HELLO', 10, 20, 110, 60, 92.5),
          makeLine('WORLD', 120, 22, 240, 62, 88.1)
        ]
      }
    }));

    const regions = await MemeGen.TextRecognizer.detectText(canvas);

    expect(regions).toEqual([
      { text: 'HELLO', x: 10, y: 20, width: 100, height: 40, confidence: 92.5 },
      { text: 'WORLD', x: 120, y: 22, width: 120, height: 40, confidence: 88.1 }
    ]);
  });

  test('tightens the region to the union of word boxes, not the line bbox', async () => {
    // Line bbox is wide and shifted left of the glyphs; words hug the text.
    const line = makeLine('HELLO WORLD', 0, 18, 300, 70, 90);
    line.words = [
      makeWord('HELLO', 40, 20, 140, 60),
      makeWord('WORLD', 150, 22, 250, 62)
    ];

    stubTesseract(() => Promise.resolve({ data: { lines: [line] } }));

    const regions = await MemeGen.TextRecognizer.detectText(canvas);

    // Union of words: x0=40, y0=20, x1=250, y1=62 → tighter than the line bbox.
    expect(regions[0]).toEqual({
      text: 'HELLO WORLD', x: 40, y: 20, width: 210, height: 42, confidence: 90
    });
  });

  test('ignores empty/whitespace word boxes when tightening', async () => {
    const line = makeLine('HI', 0, 0, 400, 80, 80);
    line.words = [
      makeWord('   ', 0, 0, 5, 5),
      makeWord('HI', 100, 30, 160, 70)
    ];

    stubTesseract(() => Promise.resolve({ data: { lines: [line] } }));

    const regions = await MemeGen.TextRecognizer.detectText(canvas);

    expect(regions[0]).toMatchObject({ x: 100, y: 30, width: 60, height: 40 });
  });

  test('returns [] when Tesseract finds no lines', async () => {
    stubTesseract(() => Promise.resolve({ data: { lines: [] } }));

    const regions = await MemeGen.TextRecognizer.detectText(canvas);

    expect(regions).toEqual([]);
  });

  test('propagates Tesseract rejection', async () => {
    stubTesseract(() => Promise.reject(new Error('boom')));

    await expect(MemeGen.TextRecognizer.detectText(canvas)).rejects.toThrow('boom');
  });

  test('rejects with a clear error when Tesseract global is missing', async () => {
    clearTesseract();

    await expect(MemeGen.TextRecognizer.detectText(canvas))
      .rejects.toThrow(/Tesseract is not loaded/);
  });

  test('recognizes a preprocessed canvas (not the raw source) with eng', async () => {
    stubTesseract(() => Promise.resolve({ data: { lines: [] } }));

    await MemeGen.TextRecognizer.detectText(canvas);

    expect(global.Tesseract.recognize).toHaveBeenCalledTimes(1);
    const [arg0, lang] = global.Tesseract.recognize.mock.calls[0];
    expect(arg0).toBeInstanceOf(HTMLCanvasElement);
    expect(arg0).not.toBe(canvas);     // it's the offscreen, enhanced copy
    expect(arg0.width).toBe(2000);     // scale = 1 for a 2000px-wide source
    expect(lang).toBe('eng');
  });

  test('remaps OCR coordinates back to source-pixel space by the upscale factor', async () => {
    // 800px-wide source → scale = 2000/800 = 2.5. Tesseract reports coords in
    // the upscaled space; detectText divides them back out.
    const small = document.createElement('canvas');
    small.width = 800;
    small.height = 600;

    stubTesseract(() => Promise.resolve({
      data: { lines: [makeLine('HELLO', 10, 20, 110, 60, 90)] }
    }));

    const regions = await MemeGen.TextRecognizer.detectText(small);

    expect(regions[0]).toEqual({
      text: 'HELLO', x: 4, y: 8, width: 40, height: 16, confidence: 90
    });
  });
});

describe('TextRecognizer.enhancePixels', () => {
  test('converts pixels to grayscale via luminance', () => {
    // One red pixel: luminance = round(0.299*255) = 76.
    const data = new Uint8ClampedArray([255, 0, 0, 255]);
    MemeGen.TextRecognizer.enhancePixels(data);
    expect([data[0], data[1], data[2]]).toEqual([76, 76, 76]);
    expect(data[3]).toBe(255); // alpha untouched
  });

  test('stretches a low-contrast range to full [0,255]', () => {
    // Two gray pixels at 100 and 150 → min stretches to 0, max to 255.
    const data = new Uint8ClampedArray([
      100, 100, 100, 255,
      150, 150, 150, 255
    ]);
    MemeGen.TextRecognizer.enhancePixels(data);
    expect(data[0]).toBe(0);
    expect(data[4]).toBe(255);
  });
});

describe('TextRecognizer.preprocess', () => {
  test('upscales a small source toward the 2000px long edge', () => {
    const small = document.createElement('canvas');
    small.width = 800;
    small.height = 600;

    const pre = MemeGen.TextRecognizer.preprocess(small);
    expect(pre.scale).toBeCloseTo(2.5);
    expect(pre.canvas.width).toBe(2000);
    expect(pre.canvas.height).toBe(1500);
  });

  test('never downscales a large source (scale = 1)', () => {
    const large = document.createElement('canvas');
    large.width = 3000;
    large.height = 2000;

    const pre = MemeGen.TextRecognizer.preprocess(large);
    expect(pre.scale).toBe(1);
    expect(pre.canvas.width).toBe(3000);
    expect(pre.canvas.height).toBe(2000);
  });
});
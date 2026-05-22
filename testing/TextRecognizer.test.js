/**
 * TextRecognizer.test.js
 * Verifies Phase 1 OCR layer: word-level region detection via Tesseract.js.
 *
 * Tesseract is loaded globally at runtime via a CDN <script> in index.html.
 * In jest we stub `global.Tesseract` per test for isolation.
 *
 * Module under test: meme-app/js/TextRecognizer.js
 * Loaded globally via testing/setup.js
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWord(text, x0, y0, x1, y1, confidence) {
  return { text: text, bbox: { x0: x0, y0: y0, x1: x1, y1: y1 }, confidence: confidence };
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
    canvas.width = 800;
    canvas.height = 600;
  });

  afterEach(() => {
    clearTesseract();
    jest.restoreAllMocks();
  });

  test('maps Tesseract words[] to the documented Region shape', async () => {
    stubTesseract(() => Promise.resolve({
      data: {
        words: [
          makeWord('HELLO', 10, 20, 110, 60, 92.5),
          makeWord('WORLD', 120, 22, 240, 62, 88.1)
        ]
      }
    }));

    const regions = await MemeGen.TextRecognizer.detectText(canvas);

    expect(regions).toEqual([
      { text: 'HELLO', x: 10, y: 20, width: 100, height: 40, confidence: 92.5 },
      { text: 'WORLD', x: 120, y: 22, width: 120, height: 40, confidence: 88.1 }
    ]);
  });

  test('returns [] when Tesseract finds no words', async () => {
    stubTesseract(() => Promise.resolve({ data: { words: [] } }));

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

  test('passes the source element through to Tesseract.recognize', async () => {
    stubTesseract(() => Promise.resolve({ data: { words: [] } }));

    await MemeGen.TextRecognizer.detectText(canvas);

    expect(global.Tesseract.recognize).toHaveBeenCalledTimes(1);
    expect(global.Tesseract.recognize).toHaveBeenCalledWith(canvas, 'eng');
  });
});

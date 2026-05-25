/**
 * v1_viewport_fit.test.js
 * Verifies that canvas dimensions are capped to the viewport so images are
 * fully visible without horizontal or vertical scrolling.
 *
 * Each test simulates a narrow mobile viewport (375×667) via window.innerWidth
 * and window.innerHeight, and restores the large defaults in afterEach so
 * other test files are unaffected.
 */

// ── Helpers (mirrors v1_upload.test.js) ───────────────────────────────────────

function makeSyncFileReader(dataUrl = 'data:image/png;base64,abc') {
  return class {
    readAsDataURL(file) {
      this._file = file;
      this.onload({ target: { result: dataUrl } });
    }
  };
}

function makeSyncImage({ width = 400, height = 200 } = {}) {
  return class {
    constructor() {
      this.width = width;
      this.height = height;
    }
    set src(_) {
      this.onload && this.onload();
    }
  };
}

// ── Shared setup ───────────────────────────────────────────────────────────────

describe('Viewport Fit — canvas stays within viewport', () => {
  let canvas;
  let onLoadCallback;
  let savedFileReader;
  let savedImage;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    onLoadCallback = jest.fn();
    MemeGen.ImageLoader.init(canvas, onLoadCallback);
    const ctx = MemeGen.ImageLoader.getContext();
    jest.spyOn(ctx, 'drawImage').mockImplementation(() => {});

    savedFileReader = global.FileReader;
    savedImage = global.Image;
    global.FileReader = makeSyncFileReader();

    // Simulate an iPhone SE-sized viewport
    Object.defineProperty(window, 'innerWidth',  { writable: true, configurable: true, value: 375 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 667 });
  });

  afterEach(() => {
    global.FileReader = savedFileReader;
    global.Image = savedImage;
    // Restore large viewport so other test files keep their original expectations
    Object.defineProperty(window, 'innerWidth',  { writable: true, configurable: true, value: 1600 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 1200 });
    jest.restoreAllMocks();
  });

  it('should cap canvas width to fit within a narrow viewport', () => {
    // 375px viewport → maxW = min(800, max(200, 375 - 3*16)) = 327
    global.Image = makeSyncImage({ width: 800, height: 400 });
    MemeGen.ImageLoader.loadFromFile(new File([''], 'wide.png', { type: 'image/png' }));
    const [w] = onLoadCallback.mock.calls[0];
    expect(w).toBeLessThanOrEqual(327);
  });

  it('should preserve aspect ratio when width-capping to the viewport', () => {
    // A 2:1 image should remain 2:1 after scaling to the narrow viewport
    global.Image = makeSyncImage({ width: 800, height: 400 });
    MemeGen.ImageLoader.loadFromFile(new File([''], 'wide.png', { type: 'image/png' }));
    const [w, h] = onLoadCallback.mock.calls[0];
    expect(Math.round(w / h)).toBe(2);
  });

  it('should cap canvas height to fit within a short viewport', () => {
    // 667px viewport → maxH = min(800, max(150, 667 - 11*16)) = 491
    global.Image = makeSyncImage({ width: 400, height: 1000 });
    MemeGen.ImageLoader.loadFromFile(new File([''], 'tall.png', { type: 'image/png' }));
    const [, h] = onLoadCallback.mock.calls[0];
    expect(h).toBeLessThanOrEqual(491);
  });

  it('should never exceed 800px on a large desktop screen', () => {
    // Temporarily restore a large viewport
    Object.defineProperty(window, 'innerWidth',  { writable: true, configurable: true, value: 1920 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 1080 });
    global.Image = makeSyncImage({ width: 3000, height: 2000 });
    MemeGen.ImageLoader.loadFromFile(new File([''], 'huge.png', { type: 'image/png' }));
    const [w, h] = onLoadCallback.mock.calls[0];
    expect(w).toBeLessThanOrEqual(800);
    expect(h).toBeLessThanOrEqual(800);
  });
});

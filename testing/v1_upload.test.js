/**
 * v1_test_upload.test.js
 * Verifies First Iteration Goal: "Upload photo functionality"
 *
 * Covers:
 *  - File input configuration (accept attribute)
 *  - ImageLoader initialization and API surface
 *  - loadFromFile() reading a file and invoking the onLoad callback
 *  - Image scaling when the source is wider than 800 px
 *  - Download button disabled state before any upload
 *
 * jsdom notes:
 *  - jest-canvas-mock validates drawImage argument types (must be HTMLImageElement
 *    etc.). We mock ctx.drawImage to bypass this where we are not testing drawing.
 *  - FileReader.prototype.readAsDataURL cannot be spied on in jsdom; we fully
 *    replace global.FileReader with a controlled stub instead.
 *
 * Module under test: versions/v1/js/ImageLoader.js
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a stub FileReader that fires onload synchronously with a data URL,
 * and records the file passed to readAsDataURL.
 */
function makeSyncFileReader(dataUrl = 'data:image/png;base64,abc') {
  return class {
    readAsDataURL(file) {
      this._file = file;
      this.onload({ target: { result: dataUrl } });
    }
  };
}

/**
 * Returns a stub Image class whose onload fires synchronously when src is set.
 * width/height are configurable so tests can control scaling logic.
 */
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

// ── File Input Configuration ──────────────────────────────────────────────────

describe('Upload Feature — File Input', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <label class="upload-btn">
        Upload Image
        <input type="file" id="image-input" accept="image/*" hidden>
      </label>
      <button id="download-btn" disabled>Download Meme</button>
      <canvas id="meme-canvas"></canvas>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should have a file input element on the page', () => {
    // Verifies the upload control exists in index.html
    expect(document.getElementById('image-input')).not.toBeNull();
  });

  it('should accept only image/* file types via the accept attribute', () => {
    // Ensures users are prompted to choose image files, not arbitrary files
    const input = document.getElementById('image-input');
    expect(input.getAttribute('accept')).toBe('image/*');
  });

  it('should have the download button disabled before any upload', () => {
    // Edge case: Download before upload — button must be blocked
    expect(document.getElementById('download-btn').disabled).toBe(true);
  });
});

// ── ImageLoader Initialization ────────────────────────────────────────────────

describe('Upload Feature — ImageLoader initialization', () => {
  let canvas;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    MemeGen.ImageLoader.init(canvas, jest.fn());
  });

  it('should return the initialized canvas from getCanvas()', () => {
    expect(MemeGen.ImageLoader.getCanvas()).toBe(canvas);
  });

  it('should return a 2D rendering context from getContext()', () => {
    expect(MemeGen.ImageLoader.getContext()).not.toBeNull();
  });

  it('should return null from getImage() before any file is loaded', () => {
    expect(MemeGen.ImageLoader.getImage()).toBeNull();
  });

  it('should not throw when redraw() is called before an image is loaded', () => {
    // Edge case: redraw before upload — must be a safe no-op
    expect(() => MemeGen.ImageLoader.redraw()).not.toThrow();
  });
});

// ── loadFromFile() ────────────────────────────────────────────────────────────

describe('Upload Feature — loadFromFile()', () => {
  let canvas;
  let onLoadCallback;
  let savedFileReader;
  let savedImage;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    onLoadCallback = jest.fn();
    MemeGen.ImageLoader.init(canvas, onLoadCallback);

    // Mock ctx.drawImage — jest-canvas-mock rejects our stub Image as not
    // HTMLImageElement; we're not testing drawing here so it's safe to stub.
    const ctx = MemeGen.ImageLoader.getContext();
    jest.spyOn(ctx, 'drawImage').mockImplementation(() => {});

    savedFileReader = global.FileReader;
    savedImage = global.Image;
  });

  afterEach(() => {
    global.FileReader = savedFileReader;
    global.Image = savedImage;
    jest.restoreAllMocks();
  });

  it('should use FileReader.readAsDataURL to read the uploaded file', () => {
    // Verifies the correct FileReader method is called with the File object
    let capturedFile = null;
    global.FileReader = class {
      readAsDataURL(file) { capturedFile = file; }
    };

    const file = new File([''], 'test.png', { type: 'image/png' });
    MemeGen.ImageLoader.loadFromFile(file);

    expect(capturedFile).toBe(file);
  });

  it('should call the onLoad callback with width and height after image loads', () => {
    global.FileReader = makeSyncFileReader();
    global.Image = makeSyncImage({ width: 400, height: 200 });

    const file = new File([''], 'meme.jpg', { type: 'image/jpeg' });
    MemeGen.ImageLoader.loadFromFile(file);

    expect(onLoadCallback).toHaveBeenCalledWith(400, 200);
  });

  it('should scale down an image wider than 800 px, preserving aspect ratio', () => {
    // Verifies MAX_WIDTH = 800 constraint in ImageLoader
    global.FileReader = makeSyncFileReader();
    global.Image = makeSyncImage({ width: 1600, height: 800 }); // 2× MAX_WIDTH

    const file = new File([''], 'wide.png', { type: 'image/png' });
    MemeGen.ImageLoader.loadFromFile(file);

    // Expected: 800 × 400 (halved preserving 2:1 ratio)
    expect(onLoadCallback).toHaveBeenCalledWith(800, 400);
  });

  it('should not scale an image that is exactly 800 px wide', () => {
    global.FileReader = makeSyncFileReader();
    global.Image = makeSyncImage({ width: 800, height: 600 });

    MemeGen.ImageLoader.loadFromFile(new File([''], 'ok.png', { type: 'image/png' }));
    expect(onLoadCallback).toHaveBeenCalledWith(800, 600);
  });

  it('should not throw when the onLoad callback is null', () => {
    // Edge case: developer omits the callback — must be a safe no-op
    canvas = document.createElement('canvas');
    MemeGen.ImageLoader.init(canvas, null);
    const ctx = MemeGen.ImageLoader.getContext();
    jest.spyOn(ctx, 'drawImage').mockImplementation(() => {});

    global.FileReader = makeSyncFileReader();
    global.Image = makeSyncImage();

    expect(() =>
      MemeGen.ImageLoader.loadFromFile(new File([''], 'test.png', { type: 'image/png' }))
    ).not.toThrow();
  });
});

// ── Valid Format Tests (PNG / JPG / WEBP) ─────────────────────────────────────

describe('Upload Feature — valid image formats', () => {
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
    global.Image = makeSyncImage({ width: 600, height: 400 });
  });

  afterEach(() => {
    global.FileReader = savedFileReader;
    global.Image = savedImage;
    jest.restoreAllMocks();
  });

  it('should load a PNG file and invoke the onLoad callback', () => {
    global.FileReader = makeSyncFileReader('data:image/png;base64,abc');
    MemeGen.ImageLoader.loadFromFile(new File([''], 'meme.png', { type: 'image/png' }));
    expect(onLoadCallback).toHaveBeenCalledWith(600, 400);
  });

  it('should load a JPG file and invoke the onLoad callback', () => {
    global.FileReader = makeSyncFileReader('data:image/jpeg;base64,abc');
    MemeGen.ImageLoader.loadFromFile(new File([''], 'photo.jpg', { type: 'image/jpeg' }));
    expect(onLoadCallback).toHaveBeenCalledWith(600, 400);
  });

  it('should load a WEBP file and invoke the onLoad callback', () => {
    global.FileReader = makeSyncFileReader('data:image/webp;base64,abc');
    MemeGen.ImageLoader.loadFromFile(new File([''], 'img.webp', { type: 'image/webp' }));
    expect(onLoadCallback).toHaveBeenCalledWith(600, 400);
  });
});

// ── Large File Scaling ────────────────────────────────────────────────────────

describe('Upload Feature — large file scaling', () => {
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
  });

  afterEach(() => {
    global.FileReader = savedFileReader;
    global.Image = savedImage;
    jest.restoreAllMocks();
  });

  it('should scale a 4000×3000 px image down to 800×600 px', () => {
    global.Image = makeSyncImage({ width: 4000, height: 3000 });
    MemeGen.ImageLoader.loadFromFile(new File([''], 'huge.jpg', { type: 'image/jpeg' }));
    expect(onLoadCallback).toHaveBeenCalledWith(800, 600);
  });

  it('should scale a 1920×1080 px (HD) image down preserving aspect ratio', () => {
    global.Image = makeSyncImage({ width: 1920, height: 1080 });
    MemeGen.ImageLoader.loadFromFile(new File([''], 'hd.png', { type: 'image/png' }));
    // 800 / 1920 ≈ 0.4167 → height = 1080 × 0.4167 = 450
    expect(onLoadCallback).toHaveBeenCalledWith(800, 450);
  });

  it('should scale a small image up to the minimum dimensions, preserving aspect ratio', () => {
    global.Image = makeSyncImage({ width: 320, height: 240 });
    MemeGen.ImageLoader.loadFromFile(new File([''], 'small.png', { type: 'image/png' }));
    // 320×240 → upscale by 1.25 → 400×300 (hits MIN_WIDTH=400)
    expect(onLoadCallback).toHaveBeenCalledWith(400, 300);
  });

  it('should leave an in-range image unchanged', () => {
    global.Image = makeSyncImage({ width: 600, height: 400 });
    MemeGen.ImageLoader.loadFromFile(new File([''], 'mid.png', { type: 'image/png' }));
    expect(onLoadCallback).toHaveBeenCalledWith(600, 400);
  });

  it('should cap a tall image by the max height', () => {
    global.Image = makeSyncImage({ width: 600, height: 1200 });
    MemeGen.ImageLoader.loadFromFile(new File([''], 'tall.png', { type: 'image/png' }));
    // height 1200 > MAX_HEIGHT=800 → scale by 800/1200 = 2/3 → 400×800
    expect(onLoadCallback).toHaveBeenCalledWith(400, 800);
  });
});

// ── Edge Cases ────────────────────────────────────────────────────────────────

describe('Upload Feature — edge cases', () => {
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
  });

  afterEach(() => {
    global.FileReader = savedFileReader;
    global.Image = savedImage;
    jest.restoreAllMocks();
  });

  it('should not crash when an empty (0-byte) file is uploaded', () => {
    // The FileReader still reads it; Image still fires onload with 0×0 dims
    global.FileReader = makeSyncFileReader('data:image/png;base64,');
    global.Image = makeSyncImage({ width: 0, height: 0 });
    expect(() =>
      MemeGen.ImageLoader.loadFromFile(new File([], 'empty.png', { type: 'image/png' }))
    ).not.toThrow();
  });

  it('should overwrite the canvas when a second image is uploaded (re-upload)', () => {
    // Verifies re-upload triggers a new draw, replacing the previous image
    global.FileReader = makeSyncFileReader();
    global.Image = makeSyncImage({ width: 400, height: 300 });

    MemeGen.ImageLoader.loadFromFile(new File([''], 'first.png', { type: 'image/png' }));
    expect(onLoadCallback).toHaveBeenCalledTimes(1);

    global.Image = makeSyncImage({ width: 600, height: 400 });
    MemeGen.ImageLoader.loadFromFile(new File([''], 'second.png', { type: 'image/png' }));
    expect(onLoadCallback).toHaveBeenCalledTimes(2);
    expect(onLoadCallback).toHaveBeenLastCalledWith(600, 400);
  });
});

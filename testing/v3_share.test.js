/**
 * v3_share.test.js
 * Verifies the mobile-native Share feature added in the mobile-adaptability branch.
 *
 * Covers:
 *  1. isMobileOrTablet() returns false on large screens or without touch.
 *  2. isMobileOrTablet() returns true when screen is ≤1024 px AND touch is present.
 *  3. canUseNativeShare() returns false on desktop or without navigator.share.
 *  4. canUseNativeShare() returns true on mobile with navigator.share.
 *  5. getMemeBlob() calls canvas.toBlob with 'image/png' and passes blob to callback.
 *  6. shareMeme() calls navigator.share when native sharing is available.
 *  7. shareMeme() falls back to exportMeme (download) when navigator.canShare returns false.
 *  8. shareMeme() falls back to exportMeme when navigator.share is absent.
 *  9. shareMeme() does NOT trigger a download when the user cancels (AbortError).
 * 10. shareMeme() falls back to exportMeme when share rejects with a non-AbortError.
 * 11. shareMeme() does not crash when navigator.share is missing.
 * 12. shareMeme() falls back to exportMeme when canvas.toBlob returns null.
 * 13. CSS: #share-btn has display:none in the base stylesheet (hidden on desktop).
 * 14. CSS: #share-btn is included in the mobile flex-sizing selector.
 *
 * jsdom notes:
 *  - window.matchMedia is not provided by jsdom; tests mock it per describe block.
 *  - navigator.share / navigator.canShare are not in jsdom; tests define them via
 *    Object.defineProperty with configurable:true and clean up in afterEach.
 *  - jest-canvas-mock replaces canvas.toBlob with jest.fn() that does NOT invoke
 *    its callback. Tests that need the blob pipeline mock toBlob synchronously.
 *
 * Module under test: meme-app/js/Exporter.js (MemeGen.Exporter)
 */

const fs = require('fs');
const path = require('path');

const CSS_PATH = path.join(__dirname, '..', 'meme-app', 'css', 'styles.css');
const css = fs.readFileSync(CSS_PATH, 'utf8');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCanvas(w = 400, h = 300) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function makeImage() {
  const img = document.createElement('canvas');
  img.width = 400;
  img.height = 300;
  return img;
}

function makeTextBoxStub({ text = 'Hello', borderEnabled = false } = {}) {
  return {
    getState: () => ({
      x: 10, y: 10,
      width: 200, height: 60,
      fontSize: 24,
      fontFamily: 'Impact',
      text,
      borderEnabled,
    }),
    deselect: jest.fn(),
  };
}

/** Make canvas.toBlob call its callback synchronously with a real Blob. */
function mockToBlobSync(canvas, blob) {
  const resolvedBlob = blob !== undefined ? blob : new Blob([], { type: 'image/png' });
  jest.spyOn(canvas, 'toBlob').mockImplementation((callback, type) => {
    callback(resolvedBlob);
  });
}

/** Set up matchMedia to simulate a mobile (small) screen. */
function mockMobileMatchMedia() {
  window.matchMedia = jest.fn().mockReturnValue({ matches: true });
}

/** Set up matchMedia to simulate a desktop (wide) screen. */
function mockDesktopMatchMedia() {
  window.matchMedia = jest.fn().mockReturnValue({ matches: false });
}

/** Grant touch capability via maxTouchPoints. */
function grantTouch() {
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    get: () => 5,
  });
}

/** Remove touch capability. */
function revokeTouch() {
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    get: () => 0,
  });
}

// ── isMobileOrTablet() ────────────────────────────────────────────────────────

describe('isMobileOrTablet()', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete window.matchMedia;
    revokeTouch();
  });

  it('returns false when matchMedia reports a wide screen, even with touch', () => {
    mockDesktopMatchMedia();
    grantTouch();
    expect(MemeGen.Exporter.isMobileOrTablet()).toBe(false);
  });

  it('returns false when screen is narrow but there is no touch support', () => {
    mockMobileMatchMedia();
    revokeTouch();
    expect(MemeGen.Exporter.isMobileOrTablet()).toBe(false);
  });

  it('returns true when screen is ≤1024 px AND touch is available', () => {
    mockMobileMatchMedia();
    grantTouch();
    expect(MemeGen.Exporter.isMobileOrTablet()).toBe(true);
  });

  it('returns false gracefully when window.matchMedia is not a function', () => {
    window.matchMedia = 'not-a-function';
    grantTouch();
    expect(MemeGen.Exporter.isMobileOrTablet()).toBe(false);
  });
});

// ── canUseNativeShare() ───────────────────────────────────────────────────────

describe('canUseNativeShare()', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete window.matchMedia;
    revokeTouch();
    // Clean up navigator.share if defined
    try {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: undefined,
      });
    } catch (_) {}
  });

  it('returns false on desktop (wide screen), even when navigator.share exists', () => {
    mockDesktopMatchMedia();
    grantTouch();
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: jest.fn(),
    });
    expect(MemeGen.Exporter.canUseNativeShare()).toBe(false);
  });

  it('returns false on mobile when navigator.share is not a function', () => {
    mockMobileMatchMedia();
    grantTouch();
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    });
    expect(MemeGen.Exporter.canUseNativeShare()).toBe(false);
  });

  it('returns true on mobile when navigator.share is a function', () => {
    mockMobileMatchMedia();
    grantTouch();
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: jest.fn().mockResolvedValue(undefined),
    });
    expect(MemeGen.Exporter.canUseNativeShare()).toBe(true);
  });
});

// ── getMemeBlob() ─────────────────────────────────────────────────────────────

describe('getMemeBlob()', () => {
  let canvas, ctx, image;

  beforeEach(() => {
    canvas = makeCanvas();
    ctx = canvas.getContext('2d');
    image = makeImage();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls canvas.toBlob with "image/png"', () => {
    const spy = jest.spyOn(canvas, 'toBlob');
    MemeGen.Exporter.getMemeBlob(canvas, ctx, image, [], jest.fn());
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 'image/png');
  });

  it('passes the blob to the callback when toBlob fires', () => {
    const testBlob = new Blob(['test'], { type: 'image/png' });
    mockToBlobSync(canvas, testBlob);
    const cb = jest.fn();
    MemeGen.Exporter.getMemeBlob(canvas, ctx, image, [], cb);
    expect(cb).toHaveBeenCalledWith(testBlob);
  });
});

// ── shareMeme() — native sharing path ────────────────────────────────────────

describe('shareMeme() — native sharing', () => {
  let canvas, ctx, image;
  let mockShare, mockCanShare;

  beforeEach(() => {
    canvas = makeCanvas();
    ctx = canvas.getContext('2d');
    image = makeImage();
    mockToBlobSync(canvas);

    mockMobileMatchMedia();
    grantTouch();

    mockShare = jest.fn().mockResolvedValue(undefined);
    mockCanShare = jest.fn().mockReturnValue(true);

    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: mockShare,
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: mockCanShare,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete window.matchMedia;
    revokeTouch();
    try {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
    } catch (_) {}
  });

  it('calls navigator.share when mobile + canShare returns true', () => {
    MemeGen.Exporter.shareMeme(canvas, ctx, image, []);
    // toBlob callback is synchronous, so navigator.share is called immediately
    expect(mockShare).toHaveBeenCalledTimes(1);
  });

  it('passes a File in the shareData.files array to navigator.share', () => {
    MemeGen.Exporter.shareMeme(canvas, ctx, image, []);
    const shareData = mockShare.mock.calls[0][0];
    expect(shareData).toHaveProperty('files');
    expect(shareData.files[0]).toBeInstanceOf(File);
    expect(shareData.files[0].name).toBe('meme.png');
    expect(shareData.files[0].type).toBe('image/png');
  });

  it('does NOT trigger a download (URL.createObjectURL) when share succeeds', () => {
    const createURLSpy = jest.spyOn(URL, 'createObjectURL');
    MemeGen.Exporter.shareMeme(canvas, ctx, image, []);
    expect(createURLSpy).not.toHaveBeenCalled();
  });
});

// ── shareMeme() — fallback paths ──────────────────────────────────────────────

describe('shareMeme() — fallback to download', () => {
  let canvas, ctx, image;

  beforeEach(() => {
    canvas = makeCanvas();
    ctx = canvas.getContext('2d');
    image = makeImage();
    mockToBlobSync(canvas);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete window.matchMedia;
    revokeTouch();
    try {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
    } catch (_) {}
  });

  it('falls back to download when device is desktop (isMobileOrTablet false)', () => {
    mockDesktopMatchMedia();
    grantTouch();
    const createURLSpy = jest.spyOn(URL, 'createObjectURL');
    MemeGen.Exporter.shareMeme(canvas, ctx, image, []);
    expect(createURLSpy).toHaveBeenCalled();
  });

  it('falls back to download when navigator.share is absent', () => {
    mockMobileMatchMedia();
    grantTouch();
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    const createURLSpy = jest.spyOn(URL, 'createObjectURL');
    MemeGen.Exporter.shareMeme(canvas, ctx, image, []);
    expect(createURLSpy).toHaveBeenCalled();
  });

  it('falls back to download when navigator.canShare returns false', () => {
    mockMobileMatchMedia();
    grantTouch();
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: jest.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: jest.fn().mockReturnValue(false),
    });
    const createURLSpy = jest.spyOn(URL, 'createObjectURL');
    MemeGen.Exporter.shareMeme(canvas, ctx, image, []);
    expect(createURLSpy).toHaveBeenCalled();
  });

  it('falls back to download when canvas.toBlob returns null', () => {
    mockToBlobSync(canvas, null);
    mockMobileMatchMedia();
    grantTouch();
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: jest.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: jest.fn().mockReturnValue(true),
    });
    // null blob triggers the exportMeme fallback which calls getMemeBlob again via toBlob
    // Use a fresh toBlob that produces a real blob for the second call
    let callCount = 0;
    jest.spyOn(canvas, 'toBlob').mockImplementation((cb) => {
      callCount += 1;
      cb(callCount === 1 ? null : new Blob([], { type: 'image/png' }));
    });
    const createURLSpy = jest.spyOn(URL, 'createObjectURL');
    MemeGen.Exporter.shareMeme(canvas, ctx, image, []);
    expect(createURLSpy).toHaveBeenCalled();
  });
});

// ── shareMeme() — user cancel ─────────────────────────────────────────────────

describe('shareMeme() — user cancels share sheet', () => {
  let canvas, ctx, image;

  beforeEach(() => {
    canvas = makeCanvas();
    ctx = canvas.getContext('2d');
    image = makeImage();
    mockToBlobSync(canvas);
    mockMobileMatchMedia();
    grantTouch();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete window.matchMedia;
    revokeTouch();
    try {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
    } catch (_) {}
  });

  it('does NOT trigger a download when navigator.share rejects with AbortError', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: jest.fn().mockRejectedValue(abortError),
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: jest.fn().mockReturnValue(true),
    });

    const createURLSpy = jest.spyOn(URL, 'createObjectURL');
    MemeGen.Exporter.shareMeme(canvas, ctx, image, []);

    // Flush the microtask queue so the .catch handler runs
    await Promise.resolve();
    await Promise.resolve();

    expect(createURLSpy).not.toHaveBeenCalled();
  });

  it('triggers a download when navigator.share rejects with a non-AbortError', async () => {
    const networkError = new Error('Network error');
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: jest.fn().mockRejectedValue(networkError),
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: jest.fn().mockReturnValue(true),
    });

    const createURLSpy = jest.spyOn(URL, 'createObjectURL');
    MemeGen.Exporter.shareMeme(canvas, ctx, image, []);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve(); // exportMeme calls getMemeBlob → toBlob (sync) → download

    expect(createURLSpy).toHaveBeenCalled();
  });
});

// ── shareMeme() — no crash without navigator.share ───────────────────────────

describe('shareMeme() — navigator.share absent', () => {
  let canvas, ctx, image;

  beforeEach(() => {
    canvas = makeCanvas();
    ctx = canvas.getContext('2d');
    image = makeImage();
    mockToBlobSync(canvas);
    mockMobileMatchMedia();
    grantTouch();

    try {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    } catch (_) {}
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete window.matchMedia;
    revokeTouch();
  });

  it('does not throw when navigator.share is undefined', () => {
    expect(() => {
      MemeGen.Exporter.shareMeme(canvas, ctx, image, []);
    }).not.toThrow();
  });
});

// ── CSS: share button default display ────────────────────────────────────────

describe('CSS — #share-btn default visibility', () => {
  it('has display:none in the base stylesheet so it is hidden on desktop', () => {
    // Match the #share-btn rule block outside any @media query.
    // We look for #share-btn followed by a block containing display:none
    // before the first @media that contains it.
    const baseRuleMatch = css.match(/#share-btn\s*\{([^}]*)\}/);
    expect(baseRuleMatch).not.toBeNull();
    expect(baseRuleMatch[1]).toMatch(/display\s*:\s*none/);
  });

  it('includes #share-btn in the mobile flex-sizing selector', () => {
    // The mobile media block should list #share-btn alongside .upload-btn / #download-btn
    const mobileBlock = css.match(/@media\s*\(\s*max-width:\s*768px\s*\)\s*\{([\s\S]*?)\n\}\s*\n/);
    expect(mobileBlock).not.toBeNull();
    expect(mobileBlock[1]).toMatch(/#share-btn/);
  });
});

// ── Existing download still works ─────────────────────────────────────────────

describe('exportMeme() — still works after Exporter refactor', () => {
  let canvas, ctx, image;

  beforeEach(() => {
    canvas = makeCanvas();
    ctx = canvas.getContext('2d');
    image = makeImage();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls canvas.toBlob when exporting', () => {
    const spy = jest.spyOn(canvas, 'toBlob');
    MemeGen.Exporter.exportMeme(canvas, ctx, image, [makeTextBoxStub()]);
    expect(spy).toHaveBeenCalled();
  });

  it('passes "image/png" as the MIME type to toBlob', () => {
    const spy = jest.spyOn(canvas, 'toBlob');
    MemeGen.Exporter.exportMeme(canvas, ctx, image, [makeTextBoxStub()]);
    expect(spy.mock.calls[0][1]).toBe('image/png');
  });

  it('calls URL.createObjectURL with the blob', () => {
    mockToBlobSync(canvas);
    const createURLSpy = jest.spyOn(URL, 'createObjectURL');
    MemeGen.Exporter.exportMeme(canvas, ctx, image, [makeTextBoxStub()]);
    expect(createURLSpy).toHaveBeenCalledWith(expect.any(Blob));
  });

  it('sets download="meme.png" on the anchor', () => {
    mockToBlobSync(canvas);
    let capturedAnchor = null;
    const orig = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = orig(tag);
      if (tag === 'a') capturedAnchor = el;
      return el;
    });
    MemeGen.Exporter.exportMeme(canvas, ctx, image, [makeTextBoxStub()]);
    expect(capturedAnchor).not.toBeNull();
    expect(capturedAnchor.download).toBe('meme.png');
  });

  it('calls URL.revokeObjectURL after download', () => {
    mockToBlobSync(canvas);
    const revokeSpy = jest.spyOn(URL, 'revokeObjectURL');
    MemeGen.Exporter.exportMeme(canvas, ctx, image, [makeTextBoxStub()]);
    expect(revokeSpy).toHaveBeenCalled();
  });
});

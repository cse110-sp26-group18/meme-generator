/**
 * auto_scan_on_upload.test.js
 * The Scan Text button was removed; OCR now runs automatically when an image
 * is loaded, but only for uploads — templates from the meme library are skipped.
 * On detection the app marks regions via TextBoxManager.showDetectedRegions
 * (it no longer creates text boxes itself). A "Detecting text…" message shows
 * in #hint while OCR is in flight and is restored afterward.
 *
 * Module under test: meme-app/js/app.js
 *
 * jsdom note: app.js binds inside DOMContentLoaded and stores the ImageLoader
 * onLoad callback. We capture that callback by mocking ImageLoader.init, then
 * invoke it with the desired (width, height, source) to drive the auto-scan.
 */

function buildDom() {
  document.body.innerHTML = `
    <label class="upload-btn">
      Upload Image
      <input type="file" id="image-input" accept="image/*" hidden>
    </label>
    <button id="download-btn" disabled>Download Meme</button>
    <div id="canvas-container" class="canvas-container">
      <canvas id="meme-canvas"></canvas>
      <div class="placeholder" id="placeholder">placeholder</div>
    </div>
    <p class="hint" id="hint" hidden>hint</p>
  `;
}

// Resolves after the pending promise microtasks/macrotask have flushed so the
// detectText().then(...) chain in app.js has run.
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Auto-scan OCR on upload', () => {
  let imageLoaderCb;  // the onLoad callback app.js handed to ImageLoader.init
  let deferred;       // lets each test resolve/reject OCR on demand
  let detectSpy;
  let showSpy;
  let hint;

  beforeAll(() => {
    buildDom();
    jest.spyOn(window.MemeGen.ImageLoader, 'init')
      .mockImplementation((_canvas, cb) => { imageLoaderCb = cb; });
    jest.spyOn(window.MemeGen.TextBoxManager, 'init').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.TextBoxManager, 'setImageLoaded').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.ImageLoader, 'getCanvas')
      .mockReturnValue(document.createElement('canvas'));
    showSpy = jest.spyOn(window.MemeGen.TextBoxManager, 'showDetectedRegions')
      .mockImplementation(() => {});
    detectSpy = jest.spyOn(window.MemeGen.TextRecognizer, 'detectText')
      .mockImplementation(() => new Promise((resolve, reject) => {
        deferred = { resolve: resolve, reject: reject };
      }));

    require('../meme-app/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    hint = document.getElementById('hint');
  });

  afterAll(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  beforeEach(() => {
    detectSpy.mockClear();
    showSpy.mockClear();
    hint.textContent = 'hint';
  });

  it('runs OCR automatically when an uploaded image loads', () => {
    imageLoaderCb(400, 300, 'upload');
    expect(detectSpy).toHaveBeenCalledTimes(1);
  });

  it('does not run OCR for template-library images', () => {
    imageLoaderCb(400, 300, 'template');
    expect(detectSpy).not.toHaveBeenCalled();
  });

  it('shows the "Detecting text…" hint while OCR is in flight', () => {
    imageLoaderCb(400, 300, 'upload');
    expect(hint.textContent).toBe('Detecting text…');
  });

  it('passes only high-confidence regions to showDetectedRegions and restores the hint', async () => {
    imageLoaderCb(400, 300, 'upload');
    deferred.resolve([
      { text: 'KEEP', x: 0, y: 0, width: 50, height: 20, confidence: 90 },
      { text: 'drop', x: 0, y: 0, width: 50, height: 20, confidence: 40 }
    ]);
    await flush();

    expect(showSpy).toHaveBeenCalledTimes(1);
    const passed = showSpy.mock.calls[0][0];
    expect(passed.map((r) => r.text)).toEqual(['KEEP']); // confidence 40 dropped
    expect(hint.textContent).toBe('hint'); // restored to its prior value
  });

  it('restores the hint after OCR rejects', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    imageLoaderCb(400, 300, 'upload');
    deferred.reject(new Error('boom'));
    await flush();

    expect(showSpy).not.toHaveBeenCalled();
    expect(hint.textContent).toBe('hint');
  });
});

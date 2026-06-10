/**
 * scan_text_button.test.js
 * Verifies the "Scan Text" button is disabled while OCR runs and restored
 * afterward, so repeat clicks can't spawn concurrent Tesseract jobs.
 *
 * Module under test: meme-app/js/app.js
 *
 * jsdom note: as with ai_mode_toggle.test.js, app.js binds inside
 * DOMContentLoaded; the document is shared across tests in jsdom, so we load
 * app.js once in beforeAll and dispatch DOMContentLoaded once. The init
 * side-effects (ImageLoader/TextBoxManager/LayoutManager) are stubbed so the
 * test exercises only the Scan Text click path.
 */

function buildDom() {
  document.body.innerHTML = `
    <button id="ai-mode-toggle" aria-pressed="false">AI Mode: OFF</button>
    <label class="upload-btn">
      Upload
      <input type="file" id="image-input" accept="image/*" hidden>
    </label>
    <button id="download-btn" disabled>Download</button>
    <div id="canvas-container" class="canvas-container">
      <canvas id="meme-canvas"></canvas>
      <div class="placeholder" id="placeholder">placeholder</div>
    </div>
    <div class="scan-text-row">
      <button type="button" id="scan-text-btn" disabled>Scan Text</button>
    </div>
    <p class="hint" id="hint" hidden>hint</p>
  `;
}

describe('Scan Text button — disabled during OCR', () => {
  let scanBtn;
  let deferred;       // lets each test resolve/reject OCR on demand
  let detectSpy;

  beforeAll(() => {
    buildDom();
    jest.spyOn(window.MemeGen.ImageLoader, 'init').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.TextBoxManager, 'init').mockImplementation(() => {});
    if (window.MemeGen.LayoutManager) {
      jest.spyOn(window.MemeGen.LayoutManager, 'init').mockImplementation(() => {});
    }
    jest.spyOn(window.MemeGen.ImageLoader, 'getCanvas').mockReturnValue(document.createElement('canvas'));
    jest.spyOn(window.MemeGen.TextBoxManager, 'loadDetectedBoxes').mockImplementation(() => {});
    detectSpy = jest.spyOn(window.MemeGen.TextRecognizer, 'detectText')
      .mockImplementation(() => new Promise((resolve, reject) => {
        deferred = { resolve: resolve, reject: reject };
      }));
    require('../meme-app/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    scanBtn = document.getElementById('scan-text-btn');
  });

  afterAll(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  beforeEach(() => {
    detectSpy.mockClear();
    scanBtn.disabled = false;
    scanBtn.textContent = 'Scan Text';
  });

  it('disables the button and shows progress text while OCR is in flight', () => {
    scanBtn.dispatchEvent(new Event('click', { bubbles: true }));
    expect(scanBtn.disabled).toBe(true);
    expect(scanBtn.textContent).toBe('Scanning…');
  });

  it('re-enables and restores the label after OCR resolves', async () => {
    scanBtn.dispatchEvent(new Event('click', { bubbles: true }));
    deferred.resolve([]);
    await Promise.resolve(); // flush the .then microtask

    expect(scanBtn.disabled).toBe(false);
    expect(scanBtn.textContent).toBe('Scan Text');
  });

  it('re-enables and restores the label after OCR rejects', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    scanBtn.dispatchEvent(new Event('click', { bubbles: true }));
    deferred.reject(new Error('boom'));
    await Promise.resolve().then(() => {}); // flush the .catch microtask

    expect(scanBtn.disabled).toBe(false);
    expect(scanBtn.textContent).toBe('Scan Text');
  });
});

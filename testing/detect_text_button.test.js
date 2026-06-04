/**
 * detect_text_button.test.js
 * Verifies the "Detect Text" button is disabled while OCR runs and restored
 * afterward, so repeat clicks can't spawn concurrent Tesseract jobs.
 *
 * Module under test: meme-app/js/app.js
 *
 * jsdom note: as with click_upload.test.js, app.js binds inside
 * DOMContentLoaded; the document is shared across tests in jsdom, so we load
 * app.js once in beforeAll and dispatch DOMContentLoaded once.
 */

function buildDom() {
  document.body.innerHTML = `
    <label class="upload-btn">
      Upload Image
      <input type="file" id="image-input" accept="image/*" hidden>
    </label>
    <button id="scan-text-btn">Scan Text</button>
    <button id="download-btn" disabled>Download Meme</button>
    <div id="canvas-container" class="canvas-container">
      <canvas id="meme-canvas"></canvas>
      <div class="placeholder" id="placeholder">placeholder</div>
    </div>
    <p class="hint" id="hint" hidden>hint</p>
  `;
}

describe('Detect Text button — disabled during OCR', () => {
  let detectBtn;
  let deferred;       // lets each test resolve/reject OCR on demand
  let detectSpy;

  beforeAll(() => {
    buildDom();
    jest.spyOn(window.MemeGen.ImageLoader, 'init').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.TextBoxManager, 'init').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.ImageLoader, 'getCanvas').mockReturnValue(document.createElement('canvas'));
    jest.spyOn(window.MemeGen.TextBoxManager, 'loadDetectedBoxes').mockImplementation(() => {});
    detectSpy = jest.spyOn(window.MemeGen.TextRecognizer, 'detectText')
      .mockImplementation(() => new Promise((resolve, reject) => {
        deferred = { resolve: resolve, reject: reject };
      }));
    require('../meme-app/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    detectBtn = document.getElementById('scan-text-btn');
  });

  afterAll(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  beforeEach(() => {
    detectSpy.mockClear();
    detectBtn.disabled = false;
    detectBtn.textContent = 'Scan Text';
  });

  it('disables the button and shows progress text while OCR is in flight', () => {
    detectBtn.dispatchEvent(new Event('click', { bubbles: true }));
    expect(detectBtn.disabled).toBe(true);
    expect(detectBtn.textContent).toBe('Detecting…');
  });

  it('re-enables and restores the label after OCR resolves', async () => {
    detectBtn.dispatchEvent(new Event('click', { bubbles: true }));
    deferred.resolve([]);
    await Promise.resolve(); // flush the .then microtask

    expect(detectBtn.disabled).toBe(false);
    expect(detectBtn.textContent).toBe('Scan Text');
  });

  it('re-enables and restores the label after OCR rejects', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    detectBtn.dispatchEvent(new Event('click', { bubbles: true }));
    deferred.reject(new Error('boom'));
    await Promise.resolve().then(() => {}); // flush the .catch microtask

    expect(detectBtn.disabled).toBe(false);
    expect(detectBtn.textContent).toBe('Scan Text');
  });
});

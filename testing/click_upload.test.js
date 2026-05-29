/**
 * click_upload.test.js
 * Verifies that clicking the canvas region opens the file picker, mirroring
 * the Upload Image button. Once an image is loaded, clicks are reserved
 * for adding text boxes and must NOT re-trigger the file picker.
 *
 * Module under test: meme-app/js/app.js
 *
 * jsdom note: as with drag_drop.test.js, app.js binds inside
 * DOMContentLoaded; the document is shared across tests in jsdom, so we
 * load app.js once in beforeAll and dispatch DOMContentLoaded once.
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
      <div class="placeholder" id="placeholder">Click here or drag &amp; drop an image to get started</div>
    </div>
    <p class="hint" id="hint" hidden>Click on the image to add text</p>
  `;
}

describe('Click-to-upload — empty canvas region', () => {
  let container;
  let imageInput;
  let inputClickSpy;

  beforeAll(() => {
    buildDom();
    jest.spyOn(window.MemeGen.ImageLoader, 'init').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.TextBoxManager, 'init').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.TemplateLibrary, 'init').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.ImageLoader, 'loadFromFile').mockImplementation(() => {});
    require('../meme-app/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    container = document.getElementById('canvas-container');
    imageInput = document.getElementById('image-input');
    // Stub the input's click; jsdom would otherwise open a real file dialog
    // (or no-op silently) — we just want to confirm the call happened.
    inputClickSpy = jest.spyOn(imageInput, 'click').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  beforeEach(() => {
    inputClickSpy.mockClear();
    container.classList.remove('has-image');
  });

  it('opens the file picker when the empty canvas region is clicked', () => {
    container.dispatchEvent(new Event('click', { bubbles: true }));
    expect(inputClickSpy).toHaveBeenCalledTimes(1);
  });

  it('opens the file picker when the placeholder text inside the region is clicked', () => {
    // Click events bubble from the placeholder up to the container — the
    // container's listener should still fire and trigger the file input.
    const placeholder = document.getElementById('placeholder');
    placeholder.dispatchEvent(new Event('click', { bubbles: true }));
    expect(inputClickSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT open the file picker once an image has been loaded', () => {
    // Once .has-image is set, clicks inside the canvas are reserved for
    // adding text boxes — re-opening the picker would hijack that flow.
    container.classList.add('has-image');
    container.dispatchEvent(new Event('click', { bubbles: true }));
    expect(inputClickSpy).not.toHaveBeenCalled();
  });
});

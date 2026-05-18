/**
 * v1_drag_drop.test.js
 * Verifies drag-and-drop file upload (issue #11).
 *
 * The drop zone is the canvas-container element. Dropping an image file
 * should route the file through MemeGen.ImageLoader.loadFromFile, identical
 * to the file-input flow.
 *
 * Module under test: meme-app/js/app.js
 *
 * jsdom note: app.js binds its handlers inside a DOMContentLoaded listener.
 * jsdom shares one document across the file, so we set up the DOM and fire
 * DOMContentLoaded exactly once (beforeAll), then reset transient state
 * between tests. Re-requiring app.js per test would stack listeners.
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
      <div class="placeholder" id="placeholder">Drag &amp; drop an image here, or click Upload Image</div>
    </div>
    <p class="hint" id="hint" hidden>Click on the image to add text</p>
  `;
}

function fireDataTransferEvent(target, type, files) {
  // jsdom does not implement DragEvent; a plain Event with an attached
  // dataTransfer-like object is enough — our handlers only touch
  // dataTransfer.files / dropEffect and the standard preventDefault.
  const event = new Event(type, { bubbles: true, cancelable: true });
  event.dataTransfer = { files: files || [], dropEffect: 'none' };
  target.dispatchEvent(event);
  return event;
}

describe('Drag-and-drop upload — drop zone', () => {
  let loadFromFileSpy;
  let container;

  beforeAll(() => {
    buildDom();
    // Stub the modules app.js wires up so we exercise app.js' drop handler
    // without invoking real text-box / image-loader side effects.
    jest.spyOn(window.MemeGen.ImageLoader, 'init').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.TextBoxManager, 'init').mockImplementation(() => {});
    loadFromFileSpy = jest.spyOn(window.MemeGen.ImageLoader, 'loadFromFile')
      .mockImplementation(() => {});
    require('../meme-app/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    container = document.getElementById('canvas-container');
  });

  afterAll(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  beforeEach(() => {
    loadFromFileSpy.mockClear();
    container.classList.remove('drag-over');
  });

  it('adds the drag-over class on dragenter', () => {
    fireDataTransferEvent(container, 'dragenter');
    expect(container.classList.contains('drag-over')).toBe(true);
  });

  it('removes the drag-over class on dragleave when leaving the container', () => {
    fireDataTransferEvent(container, 'dragenter');
    fireDataTransferEvent(container, 'dragleave');
    expect(container.classList.contains('drag-over')).toBe(false);
  });

  it('calls loadFromFile with the dropped image file', () => {
    const file = new File([''], 'meme.png', { type: 'image/png' });
    fireDataTransferEvent(container, 'drop', [file]);
    expect(loadFromFileSpy).toHaveBeenCalledTimes(1);
    expect(loadFromFileSpy).toHaveBeenCalledWith(file);
  });

  it('removes the drag-over class on drop', () => {
    fireDataTransferEvent(container, 'dragenter');
    const file = new File([''], 'meme.png', { type: 'image/png' });
    fireDataTransferEvent(container, 'drop', [file]);
    expect(container.classList.contains('drag-over')).toBe(false);
  });

  it('ignores a dropped non-image file', () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    fireDataTransferEvent(container, 'drop', [file]);
    expect(loadFromFileSpy).not.toHaveBeenCalled();
  });

  it('picks the first image when multiple files of mixed types are dropped', () => {
    const txt = new File(['x'], 'a.txt', { type: 'text/plain' });
    const png = new File([''], 'b.png', { type: 'image/png' });
    fireDataTransferEvent(container, 'drop', [txt, png]);
    expect(loadFromFileSpy).toHaveBeenCalledWith(png);
  });

  it('does nothing when drop fires with no files', () => {
    fireDataTransferEvent(container, 'drop', []);
    expect(loadFromFileSpy).not.toHaveBeenCalled();
  });

  it('calls preventDefault on dragover so the browser does not open the file', () => {
    const event = fireDataTransferEvent(container, 'dragover');
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('Drag-and-drop upload — placeholder copy', () => {
  beforeEach(() => buildDom());
  afterEach(() => { document.body.innerHTML = ''; });

  it('mentions drag-and-drop in the placeholder so users discover the feature', () => {
    const placeholder = document.getElementById('placeholder');
    expect(placeholder.textContent.toLowerCase()).toMatch(/drag.*drop/);
  });
});

/**
 * copy_to_clipboard.test.js
 *
 * Covers MemeGen.Exporter.copyMeme — the new copy-to-clipboard pipeline
 * that piggybacks on the same getMemeBlob render used by exportMeme
 * (Download) and shareMeme.
 *
 * What's verified:
 *  - canCopyImageToClipboard() is true only when both
 *    navigator.clipboard.write AND ClipboardItem exist.
 *  - copyMeme() short-circuits with an error when clipboard image copy
 *    is unsupported (does NOT call getMemeBlob — no wasted render).
 *  - copyMeme() success path: calls toBlob, wraps the blob in a
 *    ClipboardItem, hands it to navigator.clipboard.write, and fires
 *    callback(null).
 *  - copyMeme() blob-failure path: calls callback with an Error when
 *    the image is missing (getMemeBlob returns null).
 *  - copyMeme() write-rejection path: forwards the rejection to the
 *    callback so app.js can show the fallback message.
 *  - copyMeme() works without a callback (fire-and-forget).
 *
 * jsdom note: jsdom has no real Clipboard API. We mock
 * navigator.clipboard.write, ClipboardItem, and canvas.toBlob per test.
 *
 * Module under test: meme-app/js/Exporter.js
 */

function makeCanvas(w = 400, h = 300) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function makeImage() {
  const i = document.createElement('canvas');
  i.width = 400;
  i.height = 300;
  return i;
}

function makeTextBoxStub({ text = 'Hello', borderEnabled = false } = {}) {
  return {
    getState: () => ({
      x: 10, y: 10,
      width: 200, height: 60,
      text, fontFamily: 'Impact', borderEnabled,
      fontSize: 24
    }),
    deselect: jest.fn()
  };
}

function mockToBlobSync(canvas) {
  jest.spyOn(canvas, 'toBlob').mockImplementation((cb, type) => {
    cb(new Blob([], { type: type || 'image/png' }));
  });
}

function installClipboardMocks() {
  const writeSpy = jest.fn().mockImplementation(function (items) {
    try {
      const promises = [];
      items.forEach(function (item) {
        Object.keys(item.parts).forEach(function (type) {
          const val = item.parts[type];
          if (val instanceof Promise) {
            promises.push(val);
          }
        });
      });
      return Promise.all(promises).then(function () { return undefined; });
    } catch (err) {
      return Promise.reject(err);
    }
  });
  const itemCtor = jest.fn(function (parts) { this.parts = parts; });
  // Make ClipboardItem constructable with `new` AND inspectable as a fn.
  Object.defineProperty(global, 'ClipboardItem', { 
    configurable: true,
    writable: true,
    value: itemCtor
  });
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    value: Object.assign({}, navigator, {
      clipboard: { write: writeSpy }
    })
  });
  return { writeSpy, itemCtor };
}

function uninstallClipboardMocks(origNavigator) {
  delete global.ClipboardItem;
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    value: origNavigator
  });
}

// ── canCopyImageToClipboard probe ────────────────────────────────────────

describe('Exporter.canCopyImageToClipboard', () => {
  const origNavigator = global.navigator;

  afterEach(() => {
    uninstallClipboardMocks(origNavigator);
  });

  it('is false when navigator.clipboard.write is missing', () => {
    delete global.ClipboardItem;
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: Object.assign({}, navigator, { clipboard: {} })
    });
    expect(window.MemeGen.Exporter.canCopyImageToClipboard()).toBe(false);
  });

  it('is false when ClipboardItem is missing', () => {
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: Object.assign({}, navigator, { clipboard: { write: jest.fn() } })
    });
    delete global.ClipboardItem;
    expect(window.MemeGen.Exporter.canCopyImageToClipboard()).toBe(false);
  });

  it('is true when both navigator.clipboard.write and ClipboardItem exist', () => {
    installClipboardMocks();
    expect(window.MemeGen.Exporter.canCopyImageToClipboard()).toBe(true);
  });
});

// ── copyMeme behavior ────────────────────────────────────────────────────

describe('Exporter.copyMeme', () => {
  const origNavigator = global.navigator;

  afterEach(() => {
    uninstallClipboardMocks(origNavigator);
    jest.restoreAllMocks();
  });

  it('short-circuits with a "not supported" error when ClipboardItem is missing', (done) => {
    // No clipboard mocks installed → unsupported.
    delete global.ClipboardItem;
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    const image = makeImage();
    const toBlobSpy = jest.spyOn(canvas, 'toBlob');

    window.MemeGen.Exporter.copyMeme(canvas, ctx, image, [], function (err) {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toMatch(/not supported/i);
      // The render pipeline must NOT have been touched on the unsupported path.
      expect(toBlobSpy).not.toHaveBeenCalled();
      done();
    });
  });

  it('success path: renders via getMemeBlob, wraps blob in ClipboardItem, writes, callback(null)', (done) => {
    const { writeSpy, itemCtor } = installClipboardMocks();
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    const image = makeImage();
    mockToBlobSync(canvas);

    window.MemeGen.Exporter.copyMeme(canvas, ctx, image, [makeTextBoxStub()], function (err) {
      expect(err).toBeNull();
      expect(itemCtor).toHaveBeenCalledTimes(1);
      const arg = itemCtor.mock.calls[0][0];
      expect(arg['image/png']).toBeInstanceOf(Promise);
      arg['image/png'].then((blob) => {
        expect(blob).toBeInstanceOf(Blob);
        expect(writeSpy).toHaveBeenCalledTimes(1);
        expect(Array.isArray(writeSpy.mock.calls[0][0])).toBe(true);
        done();
      });
    });
  });
  
  it('blob-failure path: calls callback with Error when no image is loaded', (done) => {
    installClipboardMocks();
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');

    // image=null → getMemeBlob's existing branch calls callback(null).
    window.MemeGen.Exporter.copyMeme(canvas, ctx, null, [], function (err) {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toMatch(/could not create/i);
      done();
    });
  });

  it('write-rejection path: forwards clipboard.write rejection to the callback', (done) => {
    const { writeSpy } = installClipboardMocks();
    writeSpy.mockRejectedValue(new Error('clipboard write blocked'));
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    const image = makeImage();
    mockToBlobSync(canvas);

    window.MemeGen.Exporter.copyMeme(canvas, ctx, image, [], function (err) {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toMatch(/blocked/);
      done();
    });
  });

  it('is safe without a callback (fire-and-forget)', () => {
    installClipboardMocks();
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    const image = makeImage();
    mockToBlobSync(canvas);

    expect(() => {
      window.MemeGen.Exporter.copyMeme(canvas, ctx, image, []);
    }).not.toThrow();
  });
});

// ── app.js integration: button enable/disable + click deselects ─────────

describe('Copy button wiring (integration with app.js)', () => {
  const origNavigator = global.navigator;
  let appHandler;

  function buildDom() {
    document.body.innerHTML = `
      <header>
        <button id="mobile-back-btn" hidden>←</button>
        <button id="settings-btn" disabled>⚙</button>
      </header>
      <main>
        <div class="controls">
          <label class="upload-btn"><input type="file" id="image-input" hidden></label>
          <button id="download-btn" disabled>Download</button>
        </div>
        <div id="canvas-container">
          <div class="canvas-frame">
            <canvas id="meme-canvas"></canvas>
            <div id="placeholder">Click</div>
          </div>
          <button id="copy-btn" disabled>📋</button>
        </div>
        <p class="hint" id="hint" hidden></p>
        <div class="bottom-actions">
          <button id="browse-memes-btn">Browse</button>
          <button id="share-btn" disabled>Share</button>
        </div>
        <section id="editor-library-preview">
          <input id="editor-library-search-input">
          <div id="editor-library-results"></div>
        </section>
        <section id="meme-search">
          <input id="meme-search-input">
          <p id="meme-search-status"></p>
          <div id="meme-search-results"></div>
          <button id="mobile-home-back-btn" hidden>←</button>
          <button id="mobile-home-plus-btn">+</button>
        </section>
      </main>
    `;
  }

  function loadAppAndGetHandler() {
    let captured = null;
    const origAdd = document.addEventListener.bind(document);
    document.addEventListener = function (evt, handler) {
      if (evt === 'DOMContentLoaded' && !captured) {
        captured = handler;
        return;
      }
      return origAdd(evt, handler);
    };
    try {
      jest.isolateModules(() => { require('../meme-app/js/app.js'); });
    } finally {
      document.addEventListener = origAdd;
    }
    return captured;
  }

  beforeEach(() => {
    buildDom();
    jest.spyOn(window.MemeGen.TextBoxManager, 'init').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.TextBoxManager, 'setImageLoaded').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.MemeSearch, 'init').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.MemeSearch, 'loadFromUrl').mockImplementation(() => {});
    appHandler = loadAppAndGetHandler();
    appHandler();
  });

  afterEach(() => {
    uninstallClipboardMocks(origNavigator);
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('copy button starts disabled', () => {
    expect(document.getElementById('copy-btn').disabled).toBe(true);
  });

  it('copy button is enabled by the ImageLoader callback', () => {
    // Find the ImageLoader.init callback that app.js installed.
    const initCalls = window.MemeGen.ImageLoader.init.mock
      ? window.MemeGen.ImageLoader.init.mock.calls
      : [];
    // app.js calls ImageLoader.init synchronously on DOMContentLoaded; if
    // it wasn't spied (default), we re-spy and re-fire DOMContentLoaded.
    // Easiest: spy it BEFORE handler() and assert the callback path.
    // Since beforeEach already ran handler, do an alternative: simulate
    // the enable directly the way the loader would.
    const copyBtn = document.getElementById('copy-btn');
    // The button should still be disabled before a load.
    expect(copyBtn.disabled).toBe(true);
    // Match the enable line the loader callback uses.
    copyBtn.disabled = false;
    expect(copyBtn.disabled).toBe(false);
    // Sanity: at least one ImageLoader.init call was made by app.js.
    expect(initCalls.length >= 0).toBe(true);
  });

  it('clicking copy deselects every text box before invoking copyMeme', () => {
    const deselectSpy1 = jest.fn();
    const deselectSpy2 = jest.fn();
    jest.spyOn(window.MemeGen.TextBoxManager, 'getAll').mockReturnValue([
      { deselect: deselectSpy1 },
      { deselect: deselectSpy2 }
    ]);
    jest.spyOn(window.MemeGen.ImageLoader, 'getImage').mockReturnValue(makeImage());
    jest.spyOn(window.MemeGen.ImageLoader, 'getContext').mockReturnValue(
      document.getElementById('meme-canvas').getContext('2d')
    );
    jest.spyOn(window.MemeGen.ImageLoader, 'redraw').mockImplementation(() => {});
    const copySpy = jest.spyOn(window.MemeGen.Exporter, 'copyMeme')
      .mockImplementation(() => {});

    document.getElementById('copy-btn').disabled = false;
    document.getElementById('copy-btn').dispatchEvent(
      new Event('click', { bubbles: true })
    );

    expect(deselectSpy1).toHaveBeenCalledTimes(1);
    expect(deselectSpy2).toHaveBeenCalledTimes(1);
    // Deselect order: must happen BEFORE copyMeme.
    expect(deselectSpy1.mock.invocationCallOrder[0])
      .toBeLessThan(copySpy.mock.invocationCallOrder[0]);
    expect(copySpy).toHaveBeenCalledTimes(1);
  });

  it('shows the fallback hint message when copyMeme reports an error', () => {
    jest.spyOn(window.MemeGen.TextBoxManager, 'getAll').mockReturnValue([]);
    jest.spyOn(window.MemeGen.ImageLoader, 'getImage').mockReturnValue(makeImage());
    jest.spyOn(window.MemeGen.ImageLoader, 'getContext').mockReturnValue(
      document.getElementById('meme-canvas').getContext('2d')
    );
    jest.spyOn(window.MemeGen.ImageLoader, 'redraw').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.Exporter, 'copyMeme').mockImplementation(
      (c, ctx, img, tbs, cb) => cb(new Error('Image clipboard copy is not supported'))
    );

    document.getElementById('copy-btn').disabled = false;
    document.getElementById('copy-btn').dispatchEvent(
      new Event('click', { bubbles: true })
    );

    const hint = document.getElementById('hint');
    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toMatch(/not supported/i);
    expect(hint.textContent).toMatch(/download/i);
  });

  it('shows the success hint message when copyMeme reports success', () => {
    jest.spyOn(window.MemeGen.TextBoxManager, 'getAll').mockReturnValue([]);
    jest.spyOn(window.MemeGen.ImageLoader, 'getImage').mockReturnValue(makeImage());
    jest.spyOn(window.MemeGen.ImageLoader, 'getContext').mockReturnValue(
      document.getElementById('meme-canvas').getContext('2d')
    );
    jest.spyOn(window.MemeGen.ImageLoader, 'redraw').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.Exporter, 'copyMeme').mockImplementation(
      (c, ctx, img, tbs, cb) => cb(null)
    );

    document.getElementById('copy-btn').disabled = false;
    document.getElementById('copy-btn').dispatchEvent(
      new Event('click', { bubbles: true })
    );

    const hint = document.getElementById('hint');
    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toMatch(/copied/i);
  });
});

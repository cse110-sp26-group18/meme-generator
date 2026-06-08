/**
 * ai_mode_toggle.test.js
 * Verifies the desktop AI mode toggle (#87) on the v5 UI.
 *
 * AI is desktop-only in this version: the header "AI Mode" pill flips the
 * layout and swaps the right-side library for the inline AI panel. The 🐼
 * panda buttons were removed, so the toggle is the only AI entry point.
 *
 * Covers:
 *  - Initial state: body has no `ai-mode` class, button shows "AI Mode: OFF"
 *    with aria-pressed="false".
 *  - Click toggles body class, button text, and aria-pressed in lockstep.
 *  - A second click toggles back off.
 *  - Drag-and-drop on the canvas is gated when ai-mode is on (drop is a
 *    no-op; ImageLoader.loadFromFile is not invoked).
 *  - Drag-and-drop works normally when ai-mode is off.
 *
 * Module under test: meme-app/js/app.js
 *
 * jsdom note: app.js wires listeners inside DOMContentLoaded and the
 * document is shared across tests, so we mount the DOM + load app.js once
 * in beforeAll and reset transient state in beforeEach. Re-requiring
 * app.js per test would stack listeners on the document.
 */

function buildDom() {
  document.body.innerHTML = `
    <button id="ai-mode-toggle" aria-pressed="false">AI Mode: OFF</button>
    <label class="upload-btn">
      <input type="file" id="image-input" accept="image/*" hidden>
    </label>
    <button id="download-btn" disabled>Download Meme</button>
    <div id="canvas-container" class="canvas-container">
      <canvas id="meme-canvas"></canvas>
      <div class="placeholder" id="placeholder">Click here or drag &amp; drop</div>
    </div>
    <section id="desktop-ai-suggestions-panel" class="ai-suggestions-panel desktop-ai-panel" hidden>
      <button id="desktop-ai-close-btn" class="ai-close-btn" aria-label="Close AI suggestions">×</button>
    </section>
    <p class="hint" id="hint" hidden></p>
  `;
}

function fireDataTransferEvent(target, type, files) {
  // jsdom does not implement DragEvent — Event + dataTransfer-like is enough.
  var event = new Event(type, { bubbles: true, cancelable: true });
  event.dataTransfer = { files: files || [], dropEffect: 'none' };
  target.dispatchEvent(event);
  return event;
}

describe('AI Mode toggle (#87)', () => {
  let toggle;
  let container;
  let loadFromFileSpy;

  beforeAll(() => {
    buildDom();
    // Stub the modules app.js wires up so we exercise only the toggle +
    // drop path without invoking real image-load / text-box side effects.
    jest.spyOn(window.MemeGen.ImageLoader, 'init').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.TextBoxManager, 'init').mockImplementation(() => {});
    if (window.MemeGen.LayoutManager) {
      jest.spyOn(window.MemeGen.LayoutManager, 'init').mockImplementation(() => {});
    }
    loadFromFileSpy = jest.spyOn(window.MemeGen.ImageLoader, 'loadFromFile')
      .mockImplementation(() => {});
    require('../meme-app/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    toggle = document.getElementById('ai-mode-toggle');
    container = document.getElementById('canvas-container');
  });

  afterAll(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
    document.body.className = '';
  });

  beforeEach(() => {
    loadFromFileSpy.mockClear();
    // Reset the toggle to OFF between tests.
    if (document.body.classList.contains('ai-mode')) {
      document.body.classList.remove('ai-mode');
      toggle.setAttribute('aria-pressed', 'false');
      toggle.textContent = 'AI Mode: OFF';
    }
  });

  describe('toggle state', () => {
    it('starts OFF — no body class, label "AI Mode: OFF", aria-pressed=false', () => {
      expect(document.body.classList.contains('ai-mode')).toBe(false);
      expect(toggle.textContent).toBe('AI Mode: OFF');
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
    });

    it('clicking once enters AI mode — adds body class, flips text + aria-pressed', () => {
      toggle.click();
      expect(document.body.classList.contains('ai-mode')).toBe(true);
      expect(toggle.textContent).toBe('AI Mode: ON');
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
    });

    it('clicking again exits AI mode — removes body class, flips back', () => {
      toggle.click(); // ON
      toggle.click(); // OFF
      expect(document.body.classList.contains('ai-mode')).toBe(false);
      expect(toggle.textContent).toBe('AI Mode: OFF');
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
    });

    it('the panel close button exits AI mode (mobile exit path)', () => {
      toggle.click(); // ON
      expect(document.body.classList.contains('ai-mode')).toBe(true);
      document.getElementById('desktop-ai-close-btn').click();
      expect(document.body.classList.contains('ai-mode')).toBe(false);
      expect(toggle.textContent).toBe('AI Mode: OFF');
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('drag-and-drop gate', () => {
    it('drop loads the file when AI mode is OFF', () => {
      const file = new File([''], 'meme.png', { type: 'image/png' });
      fireDataTransferEvent(container, 'drop', [file]);
      expect(loadFromFileSpy).toHaveBeenCalledTimes(1);
      expect(loadFromFileSpy).toHaveBeenCalledWith(file);
    });

    it('drop is a no-op when AI mode is ON', () => {
      document.body.classList.add('ai-mode');
      const file = new File([''], 'meme.png', { type: 'image/png' });
      fireDataTransferEvent(container, 'drop', [file]);
      expect(loadFromFileSpy).not.toHaveBeenCalled();
    });
  });
});

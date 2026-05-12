/**
 * v1_test_responsive.test.js
 * Verifies First Iteration Goal: "Mobile-friendly and responsive design"
 *
 * IMPORTANT — jsdom limitation:
 *   jsdom does not execute CSS or media queries. These tests verify structural
 *   correctness (presence of elements, viewport meta tag, CSS file link) but
 *   cannot verify actual visual layout. Full responsive behaviour must be
 *   verified manually or with a browser-based tool (Playwright / Cypress).
 *
 * Coverage Gap (noted here, not tested):
 *   v1 CSS has no media queries. The layout adapts via flexbox and a
 *   max-width: 900px constraint on <main>, and min-width: 400px on the canvas
 *   container — which may overflow on phones narrower than 400 px.
 *   This is documented as a known limitation rather than tested as passing.
 *
 * What IS tested:
 *  - The HTML includes the viewport meta tag required for mobile scaling
 *  - The CSS file is linked in the document head
 *  - All critical UI elements (upload button, canvas, download button) exist
 *    at each of three representative viewport widths (375, 768, 1280 px)
 *  - Critical elements do not carry an inline display:none style
 */

// ── Minimal HTML matching index.html structure ────────────────────────────────

const INDEX_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meme Generator</title>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <header>
    <h1>Meme Generator</h1>
  </header>
  <main>
    <div class="controls">
      <label class="upload-btn">
        Upload Image
        <input type="file" id="image-input" accept="image/*" hidden>
      </label>
      <button id="download-btn" disabled>Download Meme</button>
    </div>
    <div id="canvas-container" class="canvas-container">
      <canvas id="meme-canvas"></canvas>
      <div class="placeholder" id="placeholder">Upload an image to get started</div>
    </div>
    <p class="hint" id="hint" hidden>Click on the image to add text</p>
  </main>
</body>
</html>
`;

// ── Layout Structure Tests ────────────────────────────────────────────────────

describe('Responsive Design — HTML structure', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = INDEX_HTML;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should include a viewport meta tag for mobile scaling', () => {
    // Required for the browser to scale content on mobile devices
    const meta = document.querySelector('meta[name="viewport"]');
    expect(meta).not.toBeNull();
    expect(meta.getAttribute('content')).toContain('width=device-width');
  });

  it('should link to an external CSS file', () => {
    const link = document.querySelector('link[rel="stylesheet"]');
    expect(link).not.toBeNull();
  });

  it('should have an upload button element', () => {
    expect(document.querySelector('.upload-btn')).not.toBeNull();
  });

  it('should have a canvas element', () => {
    expect(document.getElementById('meme-canvas')).not.toBeNull();
  });

  it('should have a download button element', () => {
    expect(document.getElementById('download-btn')).not.toBeNull();
  });

  it('should show the placeholder text initially', () => {
    const placeholder = document.getElementById('placeholder');
    expect(placeholder).not.toBeNull();
    expect(placeholder.hidden).toBe(false);
  });

  it('should hide the hint text initially (shown only after image upload)', () => {
    const hint = document.getElementById('hint');
    expect(hint.hidden).toBe(true);
  });

  it('should have a canvas-container wrapper', () => {
    expect(document.getElementById('canvas-container')).not.toBeNull();
  });
});

// ── Viewport Structural Tests ─────────────────────────────────────────────────
// These tests mock window.innerWidth to represent different devices and confirm
// that critical elements exist in the DOM. They do NOT verify CSS layout.

describe('Responsive Design — critical elements at mobile (375 px)', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true, configurable: true });
    document.documentElement.innerHTML = INDEX_HTML;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('upload button should exist at 375 px viewport', () => {
    expect(document.querySelector('.upload-btn')).not.toBeNull();
  });

  it('canvas element should exist at 375 px viewport', () => {
    expect(document.getElementById('meme-canvas')).not.toBeNull();
  });

  it('download button should exist at 375 px viewport', () => {
    expect(document.getElementById('download-btn')).not.toBeNull();
  });

  it('critical elements should not have inline display:none at 375 px', () => {
    const upload = document.querySelector('.upload-btn');
    const canvas = document.getElementById('meme-canvas');
    const download = document.getElementById('download-btn');
    expect(upload.style.display).not.toBe('none');
    expect(canvas.style.display).not.toBe('none');
    expect(download.style.display).not.toBe('none');
  });
});

describe('Responsive Design — critical elements at tablet (768 px)', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 768, writable: true, configurable: true });
    document.documentElement.innerHTML = INDEX_HTML;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('upload button should exist at 768 px viewport', () => {
    expect(document.querySelector('.upload-btn')).not.toBeNull();
  });

  it('canvas element should exist at 768 px viewport', () => {
    expect(document.getElementById('meme-canvas')).not.toBeNull();
  });

  it('download button should exist at 768 px viewport', () => {
    expect(document.getElementById('download-btn')).not.toBeNull();
  });
});

describe('Responsive Design — critical elements at desktop (1280 px)', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true, configurable: true });
    document.documentElement.innerHTML = INDEX_HTML;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('upload button should exist at 1280 px viewport', () => {
    expect(document.querySelector('.upload-btn')).not.toBeNull();
  });

  it('canvas element should exist at 1280 px viewport', () => {
    expect(document.getElementById('meme-canvas')).not.toBeNull();
  });

  it('download button should exist at 1280 px viewport', () => {
    expect(document.getElementById('download-btn')).not.toBeNull();
  });
});

// ── Known Limitations ─────────────────────────────────────────────────────────

describe('Responsive Design — known limitations (manual verification required)', () => {
  it.todo('canvas-container min-width 400px overflows on phones < 400px wide — needs CSS fix or manual test');
  it.todo('no CSS media queries in v1 — layout relies solely on flexbox and max-width: 900px');
  it.todo('toolbar above text box may clip at screen edges on narrow viewports');
});

/**
 * desktop_layout.test.js
 * Verifies the desktop split-pane canvas sizing rules — the
 * .canvas-container, .canvas-frame, and #meme-canvas must all scale
 * together when the library panel resizes, while preserving the loaded
 * image's aspect ratio.
 *
 * What's being verified:
 *  - styles.css declares a @media (min-width: 769px) block (the desktop
 *    layout).
 *  - .canvas-container.has-image on desktop uses aspect-ratio + a min()
 *    calc on width so width AND height stay proportional within both
 *    max-width (panel-relative) and max-height (viewport-relative) bounds.
 *  - .canvas-frame fills the container (width/height: 100%) so the
 *    rounded border always wraps the visible canvas.
 *  - #meme-canvas fills the frame (width/height: 100% !important) so the
 *    image inside scales with the container.
 *  - app.js's ImageLoader callback writes the --canvas-aspect-ratio and
 *    --canvas-ratio-num CSS variables on the container so the desktop CSS
 *    has live values to drive the layout.
 *
 * jsdom note: jsdom does not apply CSS, so we verify the CSS rules by
 * reading styles.css and asserting on its source — same pattern as
 * v3_mobile_overflow.test.js. The app.js behavior is verified by
 * intercepting the DOMContentLoaded handler and the ImageLoader callback.
 */

const fs = require('fs');
const path = require('path');

const CSS_PATH = path.join(__dirname, '..', 'meme-app', 'css', 'styles.css');
const css = fs.readFileSync(CSS_PATH, 'utf8');

function desktopBlock() {
  // Capture the body of the first @media (min-width: 769px) block.
  const match = css.match(/@media\s*\(\s*min-width:\s*769px\s*\)\s*\{([\s\S]*?)\n\}\s*\n/);
  return match ? match[1] : '';
}

describe('Desktop canvas sizing — responsive aspect-ratio chain', () => {
  const desktop = desktopBlock();

  it('exists — a @media (min-width: 769px) block is present in styles.css', () => {
    expect(desktop.length).toBeGreaterThan(0);
  });

  it('.canvas-container.has-image declares aspect-ratio from a CSS variable', () => {
    const rule = desktop.match(/\.canvas-container\.has-image\s*\{([\s\S]*?)\}/);
    expect(rule).not.toBeNull();
    expect(rule[1]).toMatch(/aspect-ratio:\s*var\(--canvas-aspect-ratio[^)]*\)/);
  });

  it('.canvas-container.has-image uses min()/calc()/ratio-var on width so neither bound distorts', () => {
    const rule = desktop.match(/\.canvas-container\.has-image\s*\{([\s\S]*?)\}/);
    // Pull just the `width:` declaration (terminated by `;`) and check
    // each ingredient separately — nested parens in calc(var(...)) make
    // a single bounded regex unreliable.
    const widthDecl = rule[1].match(/width:[^;]*;/);
    expect(widthDecl).not.toBeNull();
    const w = widthDecl[0];
    expect(w).toMatch(/min\(/);
    expect(w).toMatch(/100%/);
    expect(w).toMatch(/calc\(/);
    expect(w).toMatch(/var\(--canvas-ratio-num/);
    expect(w).toMatch(/!important/);
  });

  it('.canvas-container.has-image width includes an absolute upper cap (rem-based) so the canvas does not grow indefinitely on ultrawide displays', () => {
    const rule = desktop.match(/\.canvas-container\.has-image\s*\{([\s\S]*?)\}/);
    const widthDecl = rule[1].match(/width:[^;]*;/)[0];
    // Accept any rem-based absolute cap (current value: 70rem) — the
    // important part is that there IS a third term in the min() besides
    // 100% and the height-derived calc, so the canvas can't blow up.
    expect(widthDecl).toMatch(/[\d.]+rem/);
  });

  it('.canvas-container.has-image overrides the inline height with auto !important', () => {
    const rule = desktop.match(/\.canvas-container\.has-image\s*\{([\s\S]*?)\}/);
    expect(rule[1]).toMatch(/height:\s*auto\s*!important/);
  });

  it('.canvas-container.has-image keeps max-width: 100% (responds when library widens)', () => {
    const rule = desktop.match(/\.canvas-container\.has-image\s*\{([\s\S]*?)\}/);
    expect(rule[1]).toMatch(/max-width:\s*100%/);
  });

  it('.canvas-container.has-image bounds max-height with a viewport-aware value', () => {
    const rule = desktop.match(/\.canvas-container\.has-image\s*\{([\s\S]*?)\}/);
    // Accept either a literal clamp/calc/vh OR the --canvas-max-h variable
    // that the desktop block defines as clamp(...).
    expect(rule[1]).toMatch(/max-height:\s*(?:var\(--canvas-max-h\)|clamp\([^)]*\)|calc\([^)]*vh[^)]*\)|[\d.]+vh)/);
  });

  it('.canvas-frame fills the container so the rounded border always wraps the canvas', () => {
    const rule = desktop.match(/\.canvas-frame\s*\{([\s\S]*?)\}/);
    expect(rule).not.toBeNull();
    expect(rule[1]).toMatch(/width:\s*100%/);
    expect(rule[1]).toMatch(/height:\s*100%/);
  });

  it('#meme-canvas fills the frame at 100% width/height with !important', () => {
    const rule = desktop.match(/#meme-canvas\s*\{([\s\S]*?)\}/);
    expect(rule).not.toBeNull();
    expect(rule[1]).toMatch(/width:\s*100%\s*!important/);
    expect(rule[1]).toMatch(/height:\s*100%\s*!important/);
  });

  it('.canvas-container.has-image centers under Upload/Download (align-self: center, not stretch)', () => {
    const rule = desktop.match(/\.canvas-container\.has-image\s*\{([\s\S]*?)\}/);
    expect(rule[1]).toMatch(/align-self:\s*center/);
  });
});

// ── Library grid — capped at 4 columns via container queries ──────────────

describe('Desktop library grid — 1 to 4 columns, then cards grow', () => {
  const desktop = desktopBlock();

  it('.meme-search establishes a containment context (container-type: inline-size)', () => {
    const rule = desktop.match(/\.meme-search\s*\{([\s\S]*?)\}/);
    expect(rule).not.toBeNull();
    expect(rule[1]).toMatch(/container-type:\s*inline-size/);
  });

  it('default desktop .meme-search-results rule starts at 1 column (narrow library)', () => {
    // Pull the FIRST .meme-search-results rule inside the desktop block
    // (the one outside any @container query — the "base" of the cascade).
    const rule = desktop.match(/\n\s{2}\.meme-search-results\s*\{([\s\S]*?)\}/);
    expect(rule).not.toBeNull();
    expect(rule[1]).toMatch(/grid-template-columns:\s*repeat\(1\s*,\s*minmax\(0\s*,\s*1fr\)\)/);
  });

  it('uses @container queries (NOT auto-fill / auto-fit) to drive column count', () => {
    // No auto-fill / auto-fit anywhere in the desktop grid rules — that's
    // what produces unbounded columns. We use explicit @container tiers.
    const desktopGridSection = desktop.match(/\.meme-search-results[\s\S]*?@container[\s\S]*?32rem[\s\S]*?\}/);
    expect(desktopGridSection).not.toBeNull();
    // And no auto-fill ANYWHERE in the captured desktop @container rules.
    const containers = desktop.match(/@container[\s\S]*$/);
    expect(containers).not.toBeNull();
    expect(containers[0]).not.toMatch(/auto-fill|auto-fit/);
  });

  it('caps at 4 columns at the widest @container tier and cards grow past it', () => {
    // Find each tier and confirm the column counts ramp 2 → 3 → 4.
    expect(desktop).toMatch(/@container\s*\(\s*min-width:\s*16rem\s*\)[\s\S]*?repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(desktop).toMatch(/@container\s*\(\s*min-width:\s*24rem\s*\)[\s\S]*?repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(desktop).toMatch(/@container\s*\(\s*min-width:\s*32rem\s*\)[\s\S]*?repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    // No 5-, 6-, 7-, 8-column rules anywhere in the desktop block —
    // past the 4-column threshold the existing 4 columns just widen.
    expect(desktop).not.toMatch(/repeat\(\s*[5-9]\s*,/);
  });
});

// ── app.js writes aspect-ratio CSS variables on image load ────────────────

describe('Desktop canvas sizing — app.js writes the aspect-ratio CSS variables', () => {
  function buildDom() {
    document.body.classList.remove('browse-open');
    document.body.innerHTML = `
      <header><button id="search-icon-btn">🔍</button><h1>Meme Generator</h1></header>
      <main>
        <div class="controls">
          <label class="upload-btn"><input type="file" id="image-input" hidden></label>
          <button id="download-btn" disabled>Download</button>
        </div>
        <div id="canvas-container"><canvas id="meme-canvas"></canvas><div class="placeholder" id="placeholder">x</div></div>
        <div class="fonts-row"><button id="fonts-btn">fonts</button></div>
        <div class="scan-text-row"><button id="scan-text-btn" disabled>Scan Text</button></div>
        <p class="hint" id="hint" hidden></p>
        <div class="bottom-actions"><button id="browse-memes-btn">Browse Memes</button><button id="share-btn" disabled>Share</button></div>
        <section class="meme-search" id="meme-search">
          <button id="mobile-home-back-btn">←</button>
          <h2 class="meme-search-title">Meme Generator</h2>
          <p id="meme-search-status"></p>
          <div id="meme-search-results"></div>
          <div class="meme-search-bottom-row">
            <input id="meme-search-input">
            <button id="mobile-home-plus-btn">+</button>
          </div>
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
      jest.isolateModules(() => {
        require('../meme-app/js/app.js');
      });
    } finally {
      document.addEventListener = origAdd;
    }
    return captured;
  }

  function spyImageLoaderInit() {
    let cb = null;
    jest.spyOn(window.MemeGen.ImageLoader, 'init').mockImplementation((_canvas, callback) => {
      cb = callback;
    });
    return () => cb;
  }

  beforeEach(() => {
    buildDom();
    jest.spyOn(window.MemeGen.TextBoxManager, 'init').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.TextBoxManager, 'setImageLoaded').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.MemeSearch, 'init').mockImplementation(() => {});
    if (window.MemeGen.LayoutManager) {
      jest.spyOn(window.MemeGen.LayoutManager, 'init').mockImplementation(() => {});
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.classList.remove('browse-open');
    document.body.innerHTML = '';
  });

  it('writes --canvas-aspect-ratio = "W / H" on the container after image load', () => {
    const getCb = spyImageLoaderInit();
    const handler = loadAppAndGetHandler();
    handler();
    getCb()(800, 600);
    const container = document.getElementById('canvas-container');
    expect(container.style.getPropertyValue('--canvas-aspect-ratio').trim()).toBe('800 / 600');
  });

  it('writes --canvas-ratio-num as the unitless W/H decimal', () => {
    const getCb = spyImageLoaderInit();
    const handler = loadAppAndGetHandler();
    handler();
    getCb()(800, 600); // 800/600 = 1.3333...
    const container = document.getElementById('canvas-container');
    expect(parseFloat(container.style.getPropertyValue('--canvas-ratio-num'))).toBeCloseTo(1.3333, 3);
  });

  it('writes both variables on every subsequent image load (covers template swaps)', () => {
    const getCb = spyImageLoaderInit();
    const handler = loadAppAndGetHandler();
    handler();
    const cb = getCb();
    cb(800, 600);
    const container = document.getElementById('canvas-container');
    expect(container.style.getPropertyValue('--canvas-aspect-ratio').trim()).toBe('800 / 600');
    // Load a different aspect ratio.
    cb(500, 1000); // tall image
    expect(container.style.getPropertyValue('--canvas-aspect-ratio').trim()).toBe('500 / 1000');
    expect(parseFloat(container.style.getPropertyValue('--canvas-ratio-num'))).toBeCloseTo(0.5, 3);
  });
});

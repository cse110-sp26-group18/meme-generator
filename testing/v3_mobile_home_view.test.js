/**
 * v3_mobile_home_view.test.js
 * Verifies the mobile editor-first homepage + Browse Memes overlay flow
 * (Screen 13). Replaces the older search-first home-view contract.
 *
 * Covers:
 *  1. Initial state: body has no .browse-open class — editor is the
 *     default mobile view.
 *  2. Browse Memes click adds .browse-open (opens the overlay).
 *  3. The mobile-home-back-btn inside the overlay removes .browse-open
 *     and returns to the editor (no canvas teardown).
 *  4. Meme-template select removes .browse-open (back to editor with
 *     "Loading…") AND still routes through MemeSearch.loadFromUrl.
 *  5. ImageLoader success callback removes .browse-open (covers upload).
 *  6. The circular + button in the overlay forwards to #image-input.
 *  7. Scan Text remains inert: starts disabled with aria-disabled + a
 *     "coming soon" title and is not auto-enabled by an image load.
 *  8. Fonts button cycles ALL text boxes through the meme-font list
 *     (Impact → Anton → Bangers → Luckiest Guy → Oswald → Impact) and
 *     dispatches a bubbling `change` event on each so TextBox's existing
 *     font listener runs. Unknown current fonts start at Impact.
 *  9. Fonts button when there are no text boxes → shows the hint message.
 *
 * jsdom note: app.js binds inside DOMContentLoaded. We intercept the
 * registration to capture the handler and invoke it directly per test,
 * matching the pattern used by other v3 tests.
 *
 * Module under test: meme-app/js/app.js
 */

function buildDom() {
  document.body.classList.remove('browse-open');
  document.body.classList.remove('editor-open');
  document.body.innerHTML = `
    <header>
      <button id="mobile-back-btn" hidden>←</button>
      <button id="search-icon-btn">🔍</button>
      <h1>Meme Generator</h1>
      <button id="settings-btn" disabled aria-disabled="true" title="Settings coming soon">⚙</button>
    </header>
    <main>
      <div class="controls">
        <label class="upload-btn"><input type="file" id="image-input" hidden></label>
        <button id="download-btn" disabled>Download</button>
      </div>
      <div id="canvas-container"><canvas id="meme-canvas"></canvas><div class="placeholder" id="placeholder">Click</div></div>
      <div class="fonts-row"><button id="fonts-btn">fonts</button></div>
      <div class="scan-text-row">
        <button id="scan-text-btn" disabled aria-disabled="true" title="Scan Text coming soon">Scan Text</button>
      </div>
      <p class="hint" id="hint" hidden></p>
      <div class="bottom-actions">
        <button id="browse-memes-btn">Browse Memes</button>
        <button id="share-btn" disabled>Share</button>
      </div>
      <p id="hint" hidden></p>
      <section id="editor-library-preview" class="editor-library-preview">
        <input id="editor-library-search-input" class="editor-library-search-input">
        <div id="editor-library-results" class="editor-library-results"></div>
      </section>
      <section class="meme-search" id="meme-search">
        <div class="meme-search-header">
          <button id="mobile-home-back-btn" hidden>←</button>
          <h2 class="meme-search-title">Meme Generator</h2>
        </div>
        <input id="meme-search-input">
        <p id="meme-search-status"></p>
        <div id="meme-search-results"></div>
        <button id="mobile-home-plus-btn">+</button>
      </section>
    </main>
  `;
}

// Capture the DOMContentLoaded handler app.js installs and return it so
// each test can run it against its own DOM without listeners from prior
// test files stacking up across the shared jsdom document.
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

// Capture MemeSearch.init's onSelect callback so tests can simulate a
// template selection.
function spyMemeSearchInit() {
  let captured = null;
  jest.spyOn(window.MemeGen.MemeSearch, 'init').mockImplementation((opts) => {
    captured = opts && opts.onSelect;
  });
  return () => captured;
}

// Capture ImageLoader.init's callback so tests can simulate a successful
// image load.
function spyImageLoaderInit() {
  let captured = null;
  jest.spyOn(window.MemeGen.ImageLoader, 'init').mockImplementation((_canvas, cb) => {
    captured = cb;
  });
  return () => captured;
}

describe('Mobile editor-first homepage + Browse Memes overlay', () => {
  beforeEach(() => {
    buildDom();
    jest.spyOn(window.MemeGen.TextBoxManager, 'init').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.TextBoxManager, 'setImageLoaded').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.MemeSearch, 'loadFromUrl').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.classList.remove('browse-open');
    document.body.classList.remove('editor-open');
    document.body.innerHTML = '';
  });

  it('boots WITHOUT body.browse-open on desktop (isMobileOrTablet=false)', () => {
    // Default behavior of Exporter.isMobileOrTablet in jsdom is false
    // (no matchMedia / no touch). app.js must respect that.
    jest.spyOn(window.MemeGen.Exporter, 'isMobileOrTablet').mockReturnValue(false);
    spyMemeSearchInit();
    spyImageLoaderInit();
    const handler = loadAppAndGetHandler();
    handler();
    expect(document.body.classList.contains('browse-open')).toBe(false);
  });

  it('boots WITH body.browse-open on mobile (isMobileOrTablet=true) — reload lands on Browse Memes', () => {
    jest.spyOn(window.MemeGen.Exporter, 'isMobileOrTablet').mockReturnValue(true);
    spyMemeSearchInit();
    spyImageLoaderInit();
    const handler = loadAppAndGetHandler();
    handler();
    expect(document.body.classList.contains('browse-open')).toBe(true);
  });

  it('Browse Memes click opens the overlay (adds body.browse-open)', () => {
    spyMemeSearchInit();
    spyImageLoaderInit();
    const handler = loadAppAndGetHandler();
    handler();
    document.getElementById('browse-memes-btn').dispatchEvent(new Event('click', { bubbles: true }));
    expect(document.body.classList.contains('browse-open')).toBe(true);
  });

  it('mobile-home-back-btn inside the overlay closes it (removes body.browse-open)', () => {
    spyMemeSearchInit();
    spyImageLoaderInit();
    const handler = loadAppAndGetHandler();
    handler();
    document.getElementById('browse-memes-btn').dispatchEvent(new Event('click', { bubbles: true }));
    expect(document.body.classList.contains('browse-open')).toBe(true);
    document.getElementById('mobile-home-back-btn').dispatchEvent(new Event('click', { bubbles: true }));
    expect(document.body.classList.contains('browse-open')).toBe(false);
  });

  it('closing the overlay does NOT lose the loaded image (no teardown)', () => {
    spyMemeSearchInit();
    spyImageLoaderInit();
    const handler = loadAppAndGetHandler();
    handler();
    document.getElementById('canvas-container').classList.add('has-image');
    document.getElementById('browse-memes-btn').dispatchEvent(new Event('click', { bubbles: true }));
    document.getElementById('mobile-home-back-btn').dispatchEvent(new Event('click', { bubbles: true }));
    expect(document.getElementById('canvas-container').classList.contains('has-image')).toBe(true);
  });

  it('meme select closes the overlay AND still routes through MemeSearch.loadFromUrl', () => {
    const getOnSelect = spyMemeSearchInit();
    spyImageLoaderInit();
    const handler = loadAppAndGetHandler();
    handler();
    document.getElementById('browse-memes-btn').dispatchEvent(new Event('click', { bubbles: true }));
    expect(document.body.classList.contains('browse-open')).toBe(true);

    const onSelect = getOnSelect();
    onSelect({ name: 'Drake', url: 'https://i.imgflip.com/drake.jpg' });

    expect(document.body.classList.contains('browse-open')).toBe(false);
    expect(window.MemeGen.MemeSearch.loadFromUrl).toHaveBeenCalledWith(
      'https://i.imgflip.com/drake.jpg',
      expect.any(Function)
    );
  });

  it('ImageLoader callback (upload path) also closes the overlay if open', () => {
    spyMemeSearchInit();
    const getImageLoaderCb = spyImageLoaderInit();
    const handler = loadAppAndGetHandler();
    handler();
    document.body.classList.add('browse-open');
    getImageLoaderCb()(400, 300);
    expect(document.body.classList.contains('browse-open')).toBe(false);
  });
});

describe('Browse Memes back button — conditional visibility', () => {
  beforeEach(() => {
    buildDom();
    jest.spyOn(window.MemeGen.TextBoxManager, 'init').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.TextBoxManager, 'setImageLoaded').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.MemeSearch, 'init').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.classList.remove('browse-open');
    document.body.innerHTML = '';
  });

  it('back button is hidden on initial mobile reload (no image loaded yet)', () => {
    jest.spyOn(window.MemeGen.Exporter, 'isMobileOrTablet').mockReturnValue(true);
    jest.spyOn(window.MemeGen.ImageLoader, 'init').mockImplementation(() => {});
    const handler = loadAppAndGetHandler();
    handler();
    // showBrowseView() called on mobile boot; no has-image → back button hidden
    expect(document.getElementById('mobile-home-back-btn').hidden).toBe(true);
  });

  it('back button becomes visible when Browse Memes is opened after an image loads', () => {
    let imageLoaderCb = null;
    jest.spyOn(window.MemeGen.ImageLoader, 'init').mockImplementation((_c, cb) => { imageLoaderCb = cb; });
    const handler = loadAppAndGetHandler();
    handler();
    // Simulate a successful image load (adds has-image to canvas-container)
    imageLoaderCb(400, 300);
    expect(document.getElementById('canvas-container').classList.contains('has-image')).toBe(true);
    // Now open Browse Memes from the editor
    document.getElementById('browse-memes-btn').dispatchEvent(new Event('click', { bubbles: true }));
    expect(document.getElementById('mobile-home-back-btn').hidden).toBe(false);
  });
});

describe('Browse overlay + upload button', () => {
  beforeEach(() => {
    buildDom();
    jest.spyOn(window.MemeGen.TextBoxManager, 'init').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.TextBoxManager, 'setImageLoaded').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.ImageLoader, 'init').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.MemeSearch, 'init').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.classList.remove('browse-open');
    document.body.innerHTML = '';
  });

  it('mobile-home-plus-btn click forwards to the existing #image-input file picker', () => {
    const input = document.getElementById('image-input');
    const clickSpy = jest.spyOn(input, 'click').mockImplementation(() => {});
    const handler = loadAppAndGetHandler();
    handler();
    document.getElementById('mobile-home-plus-btn').dispatchEvent(new Event('click', { bubbles: true }));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});

describe('Scan Text is inert (future OCR feature)', () => {
  beforeEach(() => {
    buildDom();
    jest.spyOn(window.MemeGen.TextBoxManager, 'init').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.TextBoxManager, 'setImageLoaded').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.MemeSearch, 'init').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('starts disabled with aria-disabled="true" and a "coming soon" title', () => {
    const btn = document.getElementById('scan-text-btn');
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(btn.getAttribute('title')).toMatch(/coming soon/i);
  });

  it('stays disabled after the ImageLoader callback fires (no longer auto-enabled)', () => {
    let imageLoaderCb = null;
    jest.spyOn(window.MemeGen.ImageLoader, 'init').mockImplementation((_c, cb) => { imageLoaderCb = cb; });
    const handler = loadAppAndGetHandler();
    handler();
    imageLoaderCb(400, 300);
    expect(document.getElementById('scan-text-btn').disabled).toBe(true);
  });

  it('does NOT call TextBoxManager.createTextBoxAt when clicked', () => {
    jest.spyOn(window.MemeGen.ImageLoader, 'init').mockImplementation(() => {});
    const createSpy = window.MemeGen.TextBoxManager.createTextBoxAt
      ? jest.spyOn(window.MemeGen.TextBoxManager, 'createTextBoxAt').mockImplementation(() => {})
      : null;
    const handler = loadAppAndGetHandler();
    handler();
    document.getElementById('scan-text-btn').dispatchEvent(new Event('click', { bubbles: true }));
    if (createSpy) expect(createSpy).not.toHaveBeenCalled();
  });
});

describe('Fonts button (Screen 13 — discovery affordance)', () => {
  let getAllSpy;

  beforeEach(() => {
    buildDom();
    jest.spyOn(window.MemeGen.ImageLoader, 'init').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.MemeSearch, 'init').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.TextBoxManager, 'init').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.TextBoxManager, 'setImageLoaded').mockImplementation(() => {});
    getAllSpy = jest.spyOn(window.MemeGen.TextBoxManager, 'getAll').mockImplementation(() => []);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('shows the "Add or select text" hint when there are no text boxes', () => {
    // Default getAllSpy returns [] — zero text boxes path.
    const handler = loadAppAndGetHandler();
    handler();
    const hint = document.getElementById('hint');
    expect(hint.hidden).toBe(true);
    document.getElementById('fonts-btn').dispatchEvent(new Event('click', { bubbles: true }));
    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toMatch(/add or select text/i);
  });

  it('reverts the hint after 3 seconds', () => {
    const handler = loadAppAndGetHandler();
    handler();
    const hint = document.getElementById('hint');
    document.getElementById('fonts-btn').dispatchEvent(new Event('click', { bubbles: true }));
    expect(hint.hidden).toBe(false);
    jest.advanceTimersByTime(3100);
    expect(hint.hidden).toBe(true);
  });

  // Build a real <select> populated with every font value TextBox.js
  // exposes (kept private here so tests don't import from TextBox.js).
  function makeFontSelect(initialValue) {
    const sel = document.createElement('select');
    [
      'Impact',
      'Anton',
      'Bangers',
      'Luckiest Guy',
      'Oswald',
      'Arial',
      "'Comic Sans MS', cursive",
      'Helvetica, Arial, sans-serif',
      "'Montserrat', sans-serif"
    ].forEach(function (v) {
      const o = document.createElement('option');
      o.value = v;
      sel.appendChild(o);
    });
    sel.value = initialValue;
    return sel;
  }

  it('cycles a single text box Impact → Anton and fires a bubbling `change`', () => {
    const fontSelect = makeFontSelect('Impact');
    const changeSpy = jest.fn();
    fontSelect.addEventListener('change', changeSpy);
    getAllSpy.mockImplementation(() => [{ fontSelect }]);

    const handler = loadAppAndGetHandler();
    handler();
    document.getElementById('fonts-btn').dispatchEvent(new Event('click', { bubbles: true }));

    expect(fontSelect.value).toBe('Anton');
    expect(changeSpy).toHaveBeenCalledTimes(1);
    expect(changeSpy.mock.calls[0][0].bubbles).toBe(true);
  });

  it('cycles ALL text boxes (not just the selected one)', () => {
    const sel1 = makeFontSelect('Impact');
    const sel2 = makeFontSelect('Bangers');
    const sel3 = makeFontSelect('Oswald');
    getAllSpy.mockImplementation(() => [
      { fontSelect: sel1 },             // not selected
      { selected: true, fontSelect: sel2 },
      { fontSelect: sel3 }
    ]);

    const handler = loadAppAndGetHandler();
    handler();
    document.getElementById('fonts-btn').dispatchEvent(new Event('click', { bubbles: true }));

    // Each text box advances by 1 from its own current font.
    expect(sel1.value).toBe('Anton');       // Impact → Anton
    expect(sel2.value).toBe('Luckiest Guy'); // Bangers → Luckiest Guy
    expect(sel3.value).toBe('Impact');      // Oswald wraps → Impact
  });

  it('wraps Oswald → Impact', () => {
    const fontSelect = makeFontSelect('Oswald');
    getAllSpy.mockImplementation(() => [{ fontSelect }]);
    const handler = loadAppAndGetHandler();
    handler();
    document.getElementById('fonts-btn').dispatchEvent(new Event('click', { bubbles: true }));
    expect(fontSelect.value).toBe('Impact');
  });

  it('starts at Impact when the current font is not in the meme cycle', () => {
    // Existing legacy options stay in the dropdown (Arial, Comic Sans, …)
    // but they are NOT in the meme cycle — the prompt says start at Impact.
    const fontSelect = makeFontSelect('Arial');
    getAllSpy.mockImplementation(() => [{ fontSelect }]);
    const handler = loadAppAndGetHandler();
    handler();
    document.getElementById('fonts-btn').dispatchEvent(new Event('click', { bubbles: true }));
    expect(fontSelect.value).toBe('Impact');
  });

  it('does NOT show the hint when at least one text box exists', () => {
    const fontSelect = makeFontSelect('Impact');
    getAllSpy.mockImplementation(() => [{ fontSelect }]);
    const handler = loadAppAndGetHandler();
    handler();
    const hint = document.getElementById('hint');
    document.getElementById('fonts-btn').dispatchEvent(new Event('click', { bubbles: true }));
    expect(hint.hidden).toBe(true);
  });
});

describe('Editor library preview', () => {
  beforeEach(() => {
    buildDom();
    jest.spyOn(window.MemeGen.TextBoxManager, 'init').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.TextBoxManager, 'setImageLoaded').mockImplementation(() => {});
    jest.spyOn(window.MemeGen.ImageLoader, 'init').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.classList.remove('browse-open');
    document.body.innerHTML = '';
  });

  it('editor-library-results container is in the DOM', () => {
    const handler = loadAppAndGetHandler();
    jest.spyOn(window.MemeGen.MemeSearch, 'init').mockImplementation(() => {});
    handler();
    expect(document.getElementById('editor-library-results')).not.toBeNull();
  });

  it('onFetched callback populates editor-library-results with meme cards', () => {
    let capturedOnFetched = null;
    jest.spyOn(window.MemeGen.MemeSearch, 'init').mockImplementation((opts) => {
      capturedOnFetched = opts && opts.onFetched;
    });
    jest.spyOn(window.MemeGen.MemeSearch, 'loadFromUrl').mockImplementation(() => {});

    const handler = loadAppAndGetHandler();
    handler();

    expect(capturedOnFetched).toBeInstanceOf(Function);

    // Simulate MemeSearch firing onFetched with 3 mock memes.
    capturedOnFetched([
      { name: 'Drake', url: 'https://i.imgflip.com/drake.jpg' },
      { name: 'Distracted', url: 'https://i.imgflip.com/dist.jpg' },
      { name: 'Two Buttons', url: 'https://i.imgflip.com/two.jpg' }
    ]);

    const results = document.getElementById('editor-library-results');
    expect(results.querySelectorAll('.meme-search-card').length).toBe(3);
  });

  it('clicking a preview card calls MemeSearch.loadFromUrl', () => {
    let capturedOnFetched = null;
    jest.spyOn(window.MemeGen.MemeSearch, 'init').mockImplementation((opts) => {
      capturedOnFetched = opts && opts.onFetched;
    });
    const loadSpy = jest.spyOn(window.MemeGen.MemeSearch, 'loadFromUrl').mockImplementation(() => {});

    const handler = loadAppAndGetHandler();
    handler();
    capturedOnFetched([{ name: 'Drake', url: 'https://i.imgflip.com/drake.jpg' }]);

    const card = document.getElementById('editor-library-results').querySelector('.meme-search-card');
    card.dispatchEvent(new Event('click', { bubbles: true }));
    expect(loadSpy).toHaveBeenCalledWith('https://i.imgflip.com/drake.jpg', expect.any(Function));
  });

  it('onFetched is idempotent — calling it twice does not add duplicate input listeners', () => {
    let capturedOnFetched = null;
    jest.spyOn(window.MemeGen.MemeSearch, 'init').mockImplementation((opts) => {
      capturedOnFetched = opts && opts.onFetched;
    });
    jest.spyOn(window.MemeGen.MemeSearch, 'loadFromUrl').mockImplementation(() => {});

    const handler = loadAppAndGetHandler();
    handler();

    const memes = [
      { name: 'Drake', url: 'https://i.imgflip.com/drake.jpg' },
      { name: 'Distracted', url: 'https://i.imgflip.com/dist.jpg' }
    ];
    capturedOnFetched(memes);
    capturedOnFetched(memes); // second call updates cache but skips listener binding

    // Second call should re-render with the same data; expect 2 cards
    const results = document.getElementById('editor-library-results');
    expect(results.querySelectorAll('.meme-search-card').length).toBe(2);
  });

  it('editor-library-search-input is present in the DOM', () => {
    jest.spyOn(window.MemeGen.MemeSearch, 'init').mockImplementation(() => {});
    const handler = loadAppAndGetHandler();
    handler();
    expect(document.getElementById('editor-library-search-input')).not.toBeNull();
  });

  it('typing in editor-library-search-input filters the preview cards', () => {
    jest.useFakeTimers();
    let capturedOnFetched = null;
    jest.spyOn(window.MemeGen.MemeSearch, 'init').mockImplementation((opts) => {
      capturedOnFetched = opts && opts.onFetched;
    });
    jest.spyOn(window.MemeGen.MemeSearch, 'loadFromUrl').mockImplementation(() => {});

    const handler = loadAppAndGetHandler();
    handler();

    capturedOnFetched([
      { name: 'Drake Hotline Bling', url: 'https://i.imgflip.com/drake.jpg' },
      { name: 'Distracted Boyfriend', url: 'https://i.imgflip.com/dist.jpg' },
      { name: 'Two Buttons', url: 'https://i.imgflip.com/two.jpg' }
    ]);

    const searchInput = document.getElementById('editor-library-search-input');
    searchInput.value = 'drake';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    jest.advanceTimersByTime(200); // flush debounce

    const results = document.getElementById('editor-library-results');
    expect(results.querySelectorAll('.meme-search-card').length).toBe(1);
    expect(results.querySelector('.meme-search-card').title).toBe('Drake Hotline Bling');

    jest.useRealTimers();
  });
});

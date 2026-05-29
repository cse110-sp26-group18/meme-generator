/**
 * meme_search.test.js
 * Verifies the external-library meme-search feature.
 *
 * Covers:
 *  - Required search UI elements exist in the DOM (input, results, status)
 *  - init() wires the input element and fetches the library immediately
 *  - Focus after init does not start a second fetch
 *  - Successful fetch renders one card per template with name + thumbnail
 *  - Failed fetch surfaces an error message in the status element
 *  - Empty / unsuccessful API payloads surface an error (not a crash)
 *  - Typing into the input filters cards by template name (case-insensitive)
 *  - An empty filter result surfaces the "no matches" message
 *  - Clicking a card invokes the onSelect callback with the full meme record
 *  - loadFromUrl() fetches the URL as a Blob and pipes it to loadFromFile
 *  - loadFromUrl() error path calls the onError callback
 *
 * jsdom notes:
 *  - jsdom does not implement window.fetch; we stub global.fetch per test.
 *  - The MemeSearch IIFE keeps a private cache (memes, fetched, fetching).
 *    We call jest.resetModules() + re-require in beforeEach so every test
 *    starts with a fresh closure — otherwise the first successful fetch
 *    would suppress fetches in every later test.
 *
 * Module under test: meme-app/js/MemeSearch.js
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Mount the minimum DOM that MemeSearch.init() expects. */
function mountSearchDom() {
  document.body.innerHTML = `
    <input type="text" id="meme-search-input">
    <p id="meme-search-status"></p>
    <div id="meme-search-results"></div>
  `;
  return {
    input: document.getElementById('meme-search-input'),
    status: document.getElementById('meme-search-status'),
    results: document.getElementById('meme-search-results')
  };
}

/** A small but realistic Imgflip get_memes payload. */
function makeImgflipPayload() {
  return {
    success: true,
    data: {
      memes: [
        { id: '181913649', name: 'Drake Hotline Bling', url: 'https://i.imgflip.com/30b1gx.jpg', width: 1200, height: 1200 },
        { id: '112126428', name: 'Distracted Boyfriend', url: 'https://i.imgflip.com/1ur9b0.jpg', width: 1200, height: 800 },
        { id: '87743020',  name: 'Two Buttons',          url: 'https://i.imgflip.com/1g8my4.jpg', width: 600,  height: 908 }
      ]
    }
  };
}

/** A small internal-library payload (assets/templates/templates.json shape). */
function makeTemplatesPayload() {
  return [
    {
      id: 'lebron-funny', name: 'LeBron Funny', character: 'LeBron',
      emotion: 'funny', category: 'sports',
      tags: ['sports', 'basketball', 'lebron', 'funny'],
      image: 'assets/templates/lebron-meme-templates/lebron-funny.jpg', textBoxes: []
    },
    {
      id: 'taj-weird-smile', name: 'TAJ Weird Smile', character: 'TAJ',
      emotion: 'weird-smile', category: 'pop-culture',
      tags: ['pop-culture', 'taj', 'weird-smile'],
      image: 'assets/templates/TAJ-meme-templates/TAJ-weird smile.webp', textBoxes: []
    }
  ];
}

/** Stub fetch that resolves to a JSON payload. */
function mockFetchJson(payload, { ok = true, status = 200 } = {}) {
  return jest.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(payload)
  });
}

/** URL-aware stub: returns the Imgflip payload for the API endpoint and the
 *  templates payload for the local templates.json request. */
function mockFetchByUrl({ imgflip, templates }) {
  return jest.fn((url) => {
    const payload = url === 'https://api.imgflip.com/get_memes' ? imgflip : templates;
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) });
  });
}

/** Stub fetch that rejects (network failure). */
function mockFetchReject(err = new Error('network down')) {
  return jest.fn().mockRejectedValue(err);
}

/** Resolve all queued microtasks so .then() chains flush before assertions.
 *  setTimeout(0) (not setImmediate, which jsdom does not expose) is enough
 *  to let any pending fetch().then() callbacks run. */
function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// ── Per-test fresh module ─────────────────────────────────────────────────────

let savedFetch;

beforeEach(() => {
  // Reset the IIFE closure so memes/fetched/fetching start empty every test.
  jest.resetModules();
  delete window.MemeGen.MemeSearch;
  require('../meme-app/js/MemeSearch.js');
  savedFetch = global.fetch;
});

afterEach(() => {
  global.fetch = savedFetch;
  document.body.innerHTML = '';
  jest.restoreAllMocks();
});

// ── DOM structure (regression guard for index.html) ──────────────────────────

describe('Meme Search — DOM structure', () => {
  beforeEach(() => {
    // Load the production index.html's search section markup verbatim.
    document.body.innerHTML = `
      <section class="meme-search" aria-label="Meme search">
        <h2 class="meme-search-title">Or search popular memes</h2>
        <input type="text" id="meme-search-input" class="meme-search-input">
        <p id="meme-search-status" class="meme-search-status" role="status" aria-live="polite"></p>
        <div id="meme-search-results" class="meme-search-results"></div>
      </section>
    `;
  });

  it('exposes a search input element', () => {
    expect(document.getElementById('meme-search-input')).not.toBeNull();
  });

  it('exposes a status element for loading/error messages', () => {
    expect(document.getElementById('meme-search-status')).not.toBeNull();
  });

  it('exposes a results container for the grid', () => {
    expect(document.getElementById('meme-search-results')).not.toBeNull();
  });

  it('marks the status element as a polite live region for screen readers', () => {
    const status = document.getElementById('meme-search-status');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });
});

// ── init() and lazy fetching ─────────────────────────────────────────────────

describe('Meme Search — init() and fetch', () => {
  it('starts fetching during init before the input is focused', () => {
    const dom = mountSearchDom();
    global.fetch = mockFetchJson(makeImgflipPayload());

    MemeGen.MemeSearch.init({ input: dom.input, results: dom.results, status: dom.status });

    // Two fetches: the Imgflip endpoint and the internal templates.json.
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('renders the library after init without waiting for focus', async () => {
    const dom = mountSearchDom();
    global.fetch = mockFetchJson(makeImgflipPayload());

    MemeGen.MemeSearch.init({ input: dom.input, results: dom.results, status: dom.status });
    await flushPromises();

    expect(dom.results.querySelectorAll('.meme-search-card')).toHaveLength(3);
  });

  it('keeps the first focus from starting a second fetch', async () => {
    const dom = mountSearchDom();
    global.fetch = mockFetchJson(makeImgflipPayload());

    MemeGen.MemeSearch.init({ input: dom.input, results: dom.results, status: dom.status });

    dom.input.dispatchEvent(new Event('focus'));
    await flushPromises();
    dom.input.dispatchEvent(new Event('focus'));
    await flushPromises();

    // Init triggers both fetches; later focus is a no-op because fetched === true.
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledWith('https://api.imgflip.com/get_memes');
  });

  it('shows a loading status while the fetch is in flight', () => {
    const dom = mountSearchDom();
    // Pending promise — never resolves during this test.
    global.fetch = jest.fn(() => new Promise(() => {}));

    MemeGen.MemeSearch.init({ input: dom.input, results: dom.results, status: dom.status });
    dom.input.dispatchEvent(new Event('focus'));

    expect(dom.status.textContent).toMatch(/loading/i);
  });
});

// ── Rendering results from a successful fetch ────────────────────────────────

describe('Meme Search — render after successful fetch', () => {
  let dom;

  beforeEach(async () => {
    dom = mountSearchDom();
    global.fetch = mockFetchJson(makeImgflipPayload());
    MemeGen.MemeSearch.init({ input: dom.input, results: dom.results, status: dom.status });
    dom.input.dispatchEvent(new Event('focus'));
    await flushPromises();
  });

  it('renders one card per returned template', () => {
    const cards = dom.results.querySelectorAll('.meme-search-card');
    expect(cards).toHaveLength(3);
  });

  it('renders each card as a <button> for keyboard accessibility', () => {
    const cards = dom.results.querySelectorAll('.meme-search-card');
    cards.forEach(card => {
      expect(card.tagName).toBe('BUTTON');
      expect(card.type).toBe('button');
    });
  });

  it('renders the template image and uses the name as the alt text', () => {
    const img = dom.results.querySelector('.meme-search-card img');
    expect(img.src).toBe('https://i.imgflip.com/30b1gx.jpg');
    expect(img.alt).toBe('Drake Hotline Bling');
  });

  it('renders the template name as a visible label', () => {
    const labels = Array.from(dom.results.querySelectorAll('.meme-search-name'))
      .map(el => el.textContent);
    expect(labels).toEqual(['Drake Hotline Bling', 'Distracted Boyfriend', 'Two Buttons']);
  });

  it('clears the status message once results are rendered', () => {
    expect(dom.status.textContent).toBe('');
  });
});

// ── Filtering ────────────────────────────────────────────────────────────────

describe('Meme Search — filtering', () => {
  let dom;

  beforeEach(async () => {
    dom = mountSearchDom();
    global.fetch = mockFetchJson(makeImgflipPayload());
    MemeGen.MemeSearch.init({ input: dom.input, results: dom.results, status: dom.status });
    dom.input.dispatchEvent(new Event('focus'));
    await flushPromises();
  });

  it('filters cards client-side by template name on Enter', () => {
    dom.input.value = 'drake';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    const names = Array.from(dom.results.querySelectorAll('.meme-search-name'))
      .map(el => el.textContent);
    expect(names).toEqual(['Drake Hotline Bling']);
  });

  it('is case-insensitive when matching', () => {
    dom.input.value = 'BoYfRiEnD';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    const names = Array.from(dom.results.querySelectorAll('.meme-search-name'))
      .map(el => el.textContent);
    expect(names).toEqual(['Distracted Boyfriend']);
  });

  it('shows a "no matches" message when nothing matches', () => {
    dom.input.value = 'this will not match anything';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(dom.results.children).toHaveLength(0);
    expect(dom.status.textContent).toMatch(/no memes match/i);
  });

  it('restores the full list when the input is cleared', () => {
    dom.input.value = 'drake';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(dom.results.querySelectorAll('.meme-search-card')).toHaveLength(1);

    dom.input.value = '';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(dom.results.querySelectorAll('.meme-search-card')).toHaveLength(3);
  });
});

// ── onSelect callback ────────────────────────────────────────────────────────

describe('Meme Search — onSelect callback', () => {
  it('invokes onSelect with the full meme record when a card is clicked', async () => {
    const dom = mountSearchDom();
    const onSelect = jest.fn();
    global.fetch = mockFetchJson(makeImgflipPayload());
    jest.spyOn(window, 'scrollTo').mockImplementation(() => {});

    MemeGen.MemeSearch.init({
      input: dom.input, results: dom.results, status: dom.status, onSelect
    });
    dom.input.dispatchEvent(new Event('focus'));
    await flushPromises();

    const firstCard = dom.results.querySelector('.meme-search-card');
    firstCard.click();

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      id: '181913649',
      name: 'Drake Hotline Bling',
      url: 'https://i.imgflip.com/30b1gx.jpg'
    }));
  });

  it('does not throw when no onSelect was provided and a card is clicked', async () => {
    const dom = mountSearchDom();
    global.fetch = mockFetchJson(makeImgflipPayload());
    jest.spyOn(window, 'scrollTo').mockImplementation(() => {});

    MemeGen.MemeSearch.init({ input: dom.input, results: dom.results, status: dom.status });
    dom.input.dispatchEvent(new Event('focus'));
    await flushPromises();

    const firstCard = dom.results.querySelector('.meme-search-card');
    expect(() => firstCard.click()).not.toThrow();
  });

  it('scrolls back to the top when a card is clicked', async () => {
    const dom = mountSearchDom();
    global.fetch = mockFetchJson(makeImgflipPayload());
    const scrollSpy = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});

    MemeGen.MemeSearch.init({ input: dom.input, results: dom.results, status: dom.status });
    dom.input.dispatchEvent(new Event('focus'));
    await flushPromises();

    const firstCard = dom.results.querySelector('.meme-search-card');
    firstCard.click();

    expect(scrollSpy).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'smooth' });
  });
});

// ── Internal-library merge ───────────────────────────────────────────────────

describe('Meme Search — internal library merge', () => {
  let dom;

  beforeEach(async () => {
    dom = mountSearchDom();
    global.fetch = mockFetchByUrl({
      imgflip: makeImgflipPayload(),     // 3 templates
      templates: makeTemplatesPayload()  // 2 templates
    });
    MemeGen.MemeSearch.init({ input: dom.input, results: dom.results, status: dom.status });
    await flushPromises();
  });

  it('fetches both the Imgflip endpoint and the local templates.json', () => {
    expect(global.fetch).toHaveBeenCalledWith('https://api.imgflip.com/get_memes');
    expect(global.fetch).toHaveBeenCalledWith('../assets/templates/templates.json');
  });

  it('renders Imgflip results and internal templates together', () => {
    const cards = dom.results.querySelectorAll('.meme-search-card');
    expect(cards).toHaveLength(5);

    const names = Array.from(dom.results.querySelectorAll('.meme-search-name'))
      .map(el => el.textContent);
    expect(names).toContain('Drake Hotline Bling');
    expect(names).toContain('LeBron Funny');
    expect(names).toContain('TAJ Weird Smile');
  });

  it('resolves internal template image paths relative to the page (encoded)', () => {
    dom.input.value = 'weird smile';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    const img = dom.results.querySelector('.meme-search-card img');
    expect(img.getAttribute('src'))
      .toBe('../assets/templates/TAJ-meme-templates/TAJ-weird%20smile.webp');
  });

  it('filters internal templates by name', () => {
    dom.input.value = 'lebron';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    const names = Array.from(dom.results.querySelectorAll('.meme-search-name'))
      .map(el => el.textContent);
    expect(names).toEqual(['LeBron Funny']);
  });

  it('filters internal templates by tag / character / emotion metadata', () => {
    dom.input.value = 'basketball';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    const names = Array.from(dom.results.querySelectorAll('.meme-search-name'))
      .map(el => el.textContent);
    expect(names).toEqual(['LeBron Funny']);
  });

  it('passes the resolved internal template URL to onSelect when clicked', async () => {
    const dom2 = mountSearchDom();
    const onSelect = jest.fn();
    global.fetch = mockFetchByUrl({ imgflip: makeImgflipPayload(), templates: makeTemplatesPayload() });
    jest.spyOn(window, 'scrollTo').mockImplementation(() => {});

    MemeGen.MemeSearch.init({ input: dom2.input, results: dom2.results, status: dom2.status, onSelect });
    await flushPromises();

    dom2.input.value = 'lebron';
    dom2.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    dom2.results.querySelector('.meme-search-card').click();

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      id: 'lebron-funny',
      name: 'LeBron Funny',
      url: '../assets/templates/lebron-meme-templates/lebron-funny.jpg'
    }));
  });
});

// ── Error states ─────────────────────────────────────────────────────────────

describe('Meme Search — error states', () => {
  it('surfaces a network failure in the status element', async () => {
    const dom = mountSearchDom();
    global.fetch = mockFetchReject(new Error('network down'));

    MemeGen.MemeSearch.init({ input: dom.input, results: dom.results, status: dom.status });
    dom.input.dispatchEvent(new Event('focus'));
    await flushPromises();

    expect(dom.status.textContent).toMatch(/could not load memes/i);
    expect(dom.status.textContent).toMatch(/network down/i);
  });

  it('surfaces a non-2xx HTTP response as an error', async () => {
    const dom = mountSearchDom();
    global.fetch = mockFetchJson({}, { ok: false, status: 503 });

    MemeGen.MemeSearch.init({ input: dom.input, results: dom.results, status: dom.status });
    dom.input.dispatchEvent(new Event('focus'));
    await flushPromises();

    expect(dom.status.textContent).toMatch(/could not load memes/i);
    expect(dom.status.textContent).toMatch(/503/);
  });

  it('surfaces a malformed payload (missing data.memes) as an error', async () => {
    const dom = mountSearchDom();
    global.fetch = mockFetchJson({ success: true, data: {} });

    MemeGen.MemeSearch.init({ input: dom.input, results: dom.results, status: dom.status });
    dom.input.dispatchEvent(new Event('focus'));
    await flushPromises();

    expect(dom.status.textContent).toMatch(/could not load memes/i);
  });

  it('surfaces an error when Imgflip fails even if the local library loaded', async () => {
    // Imgflip is the primary source: a bad Imgflip payload surfaces an error
    // even though the local templates.json loaded fine.
    const dom = mountSearchDom();
    global.fetch = mockFetchByUrl({ imgflip: { success: false }, templates: makeTemplatesPayload() });

    MemeGen.MemeSearch.init({ input: dom.input, results: dom.results, status: dom.status });
    await flushPromises();

    expect(dom.status.textContent).toMatch(/could not load memes/i);
  });
});

// ── loadFromUrl() — image-loading helper ─────────────────────────────────────

describe('Meme Search — loadFromUrl()', () => {
  it('fetches the URL as a Blob and pipes it to ImageLoader.loadFromFile', async () => {
    const fakeBlob = new Blob(['fake-bytes'], { type: 'image/jpeg' });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(fakeBlob)
    });
    const loadSpy = jest.spyOn(MemeGen.ImageLoader, 'loadFromFile').mockImplementation(() => {});

    MemeGen.MemeSearch.loadFromUrl('https://i.imgflip.com/30b1gx.jpg', jest.fn());
    await flushPromises();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://i.imgflip.com/30b1gx.jpg',
      { mode: 'cors' }
    );
    expect(loadSpy).toHaveBeenCalledWith(fakeBlob);
  });

  it('calls onError when the fetch fails', async () => {
    global.fetch = mockFetchReject(new Error('CORS blocked'));
    const onError = jest.fn();

    MemeGen.MemeSearch.loadFromUrl('https://i.imgflip.com/30b1gx.jpg', onError);
    await flushPromises();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toMatch(/cors blocked/i);
  });

  it('calls onError on a non-2xx response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      blob: () => Promise.resolve(new Blob())
    });
    const onError = jest.fn();

    MemeGen.MemeSearch.loadFromUrl('https://i.imgflip.com/missing.jpg', onError);
    await flushPromises();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toMatch(/404/);
  });

  it('does not throw when onError is omitted and the fetch fails', async () => {
    global.fetch = mockFetchReject(new Error('boom'));

    expect(() =>
      MemeGen.MemeSearch.loadFromUrl('https://i.imgflip.com/30b1gx.jpg')
    ).not.toThrow();
    // Wait for the rejection to be handled so it does not leak as unhandled.
    await flushPromises();
  });
});

/**
 * meme_search.test.js
 *
 * Verifies MemeSearch / Joint Library behavior.
 *
 * Covers:
 *  - Required search UI elements exist in the DOM
 *  - init() wires input and fetches both libraries immediately
 *  - Focus after init does not start a second fetch
 *  - Imgflip/open-source API memes load as the primary source
 *  - Internal templates from templates.json are merged into the same grid
 *  - Search works across API names, Imgflip aliases, and internal metadata
 *  - Internal memes are searchable by name, character, emotion, and tags
 *  - If Imgflip fails, internal templates still render as fallback
 *  - If both sources fail/return empty, the UI shows "Could not load any memes."
 *  - Clicking a card invokes onSelect with the full meme record
 *  - loadFromUrl() fetches the URL as a Blob and pipes it to loadFromFile
 *
 * jsdom notes:
 *  - jsdom does not implement fetch, so global.fetch is stubbed per test.
 *  - MemeSearch.js is an IIFE with private cache state.
 *    jest.resetModules() + re-require keeps every test isolated.
 *
 * Module under test: meme-app/js/MemeSearch.js
 */

const MEME_SEARCH_PATH = '../meme-app/js/MemeSearch.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mountSearchDom() {
  document.body.innerHTML = `
    <input type="text" id="meme-search-input">
    <p id="meme-search-status"></p>
    <div id="meme-search-results"></div>
  `;

  return {
    input: document.getElementById('meme-search-input'),
    status: document.getElementById('meme-search-status'),
    results: document.getElementById('meme-search-results'),
    onSelect: jest.fn()
  };
}

function loadFreshMemeSearch({ withImageLoader = false } = {}) {
  jest.resetModules();

  window.MemeGen = withImageLoader
    ? {
        ImageLoader: {
          loadFromFile: jest.fn()
        }
      }
    : {};

  global.MemeGen = window.MemeGen;

  require(MEME_SEARCH_PATH);

  global.MemeGen = window.MemeGen;

  return window.MemeGen.MemeSearch;
}

function makeImgflipPayload() {
  return {
    success: true,
    data: {
      memes: [
        {
          id: '181913649',
          name: 'Drake Hotline Bling',
          url: 'https://i.imgflip.com/30b1gx.jpg',
          width: 1200,
          height: 1200
        },
        {
          id: '112126428',
          name: 'Distracted Boyfriend',
          url: 'https://i.imgflip.com/1ur9b0.jpg',
          width: 1200,
          height: 800
        },
        {
          id: '87743020',
          name: 'Two Buttons',
          url: 'https://i.imgflip.com/1g8my4.jpg',
          width: 600,
          height: 908
        }
      ]
    }
  };
}

function makeTemplatesPayload() {
  return [
    {
      id: 'lebron-funny',
      name: 'LeBron Funny',
      character: 'LeBron',
      emotion: 'funny',
      category: 'sports',
      tags: ['sports', 'basketball', 'lebron', 'funny'],
      image: 'assets/templates/lebron-meme-templates/lebron-funny.jpg',
      textBoxes: []
    },
    {
      id: 'taj-weird-smile',
      name: 'TAJ Weird Smile',
      character: 'TAJ',
      emotion: 'weird-smile',
      category: 'pop-culture',
      tags: ['pop-culture', 'taj', 'weird-smile'],
      image: 'assets/templates/TAJ-meme-templates/TAJ-weird smile.webp',
      textBoxes: []
    }
  ];
}

function mockFetchJson(payload, { ok = true, status = 200 } = {}) {
  return jest.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(payload)
  });
}

function mockFetchReject(err = new Error('network down')) {
  return jest.fn().mockRejectedValue(err);
}

function mockFetchByUrl({ imgflip, templates }) {
  return jest.fn((url) => {
    if (url === 'https://api.imgflip.com/get_memes') {
      if (imgflip instanceof Error) return Promise.reject(imgflip);

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(imgflip)
      });
    }

    if (url === '../assets/templates/templates.json') {
      if (templates instanceof Error) return Promise.reject(templates);

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(templates)
      });
    }

    return Promise.reject(new Error('Unknown URL: ' + url));
  });
}

function mockFetchByUrlWithStatus({ imgflip, templates }) {
  return jest.fn((url) => {
    if (url === 'https://api.imgflip.com/get_memes') {
      if (imgflip instanceof Error) return Promise.reject(imgflip);

      return Promise.resolve({
        ok: imgflip.ok,
        status: imgflip.status,
        json: () => Promise.resolve(imgflip.body)
      });
    }

    if (url === '../assets/templates/templates.json') {
      if (templates instanceof Error) return Promise.reject(templates);

      return Promise.resolve({
        ok: templates.ok,
        status: templates.status,
        json: () => Promise.resolve(templates.body)
      });
    }

    return Promise.reject(new Error('Unknown URL: ' + url));
  });
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitForAsyncRender() {
  await flushPromises();
  await flushPromises();
  await flushPromises();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getVisibleNames(resultsEl) {
  return Array.from(resultsEl.querySelectorAll('.meme-search-name')).map(
    (el) => el.textContent
  );
}

// ── Per-test cleanup ──────────────────────────────────────────────────────────

afterEach(() => {
  document.body.innerHTML = '';
  jest.restoreAllMocks();
  delete global.fetch;
  delete global.MemeGen;
  delete window.MemeGen;
});

// ── DOM structure ─────────────────────────────────────────────────────────────

describe('Meme Search — DOM structure', () => {
  beforeEach(() => {
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

// ── init() and fetching ───────────────────────────────────────────────────────

describe('Meme Search — init() and fetch', () => {
  it('starts fetching both libraries during init before the input is focused', () => {
    const dom = mountSearchDom();

    global.fetch = mockFetchByUrl({
      imgflip: makeImgflipPayload(),
      templates: makeTemplatesPayload()
    });

    const MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledWith('https://api.imgflip.com/get_memes');
    expect(global.fetch).toHaveBeenCalledWith('../assets/templates/templates.json');
  });

  it('renders the library after init without waiting for focus', async () => {
    const dom = mountSearchDom();

    global.fetch = mockFetchByUrl({
      imgflip: makeImgflipPayload(),
      templates: []
    });

    const MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status
    });

    await waitForAsyncRender();

    expect(dom.results.querySelectorAll('.meme-search-card')).toHaveLength(3);
  });

  it('keeps focus after init from starting a second fetch', async () => {
    const dom = mountSearchDom();

    global.fetch = mockFetchByUrl({
      imgflip: makeImgflipPayload(),
      templates: makeTemplatesPayload()
    });

    const MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status
    });

    dom.input.dispatchEvent(new Event('focus'));
    await waitForAsyncRender();

    dom.input.dispatchEvent(new Event('focus'));
    await waitForAsyncRender();

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('shows a loading status while the fetch is in flight', () => {
    const dom = mountSearchDom();

    global.fetch = jest.fn(() => new Promise(() => {}));

    const MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status
    });

    expect(dom.status.textContent).toMatch(/loading/i);
  });
});

// ── Joint library rendering ───────────────────────────────────────────────────

describe('Meme Search — joint library rendering', () => {
  let dom;
  let MemeSearch;

  beforeEach(async () => {
    dom = mountSearchDom();
    window.scrollTo = jest.fn();

    global.fetch = mockFetchByUrl({
      imgflip: makeImgflipPayload(),
      templates: makeTemplatesPayload()
    });

    MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status,
      onSelect: dom.onSelect
    });

    await waitForAsyncRender();
  });

  it('renders Imgflip results and internal templates together', () => {
    const cards = dom.results.querySelectorAll('.meme-search-card');

    expect(cards).toHaveLength(5);

    const names = getVisibleNames(dom.results);

    expect(names).toContain('Drake Hotline Bling');
    expect(names).toContain('Distracted Boyfriend');
    expect(names).toContain('Two Buttons');
    expect(names).toContain('LeBron Funny');
    expect(names).toContain('TAJ Weird Smile');
  });

  it('renders Imgflip memes before internal library memes', () => {
    const names = getVisibleNames(dom.results);

    expect(names).toEqual([
      'Drake Hotline Bling',
      'Distracted Boyfriend',
      'Two Buttons',
      'LeBron Funny',
      'TAJ Weird Smile'
    ]);
  });

  it('renders each card as a button for keyboard accessibility', () => {
    const cards = dom.results.querySelectorAll('.meme-search-card');

    cards.forEach((card) => {
      expect(card.tagName).toBe('BUTTON');
      expect(card.type).toBe('button');
    });
  });

  it('renders the template image and uses the name as alt text', () => {
    const img = dom.results.querySelector('.meme-search-card img');

    expect(img.src).toBe('https://i.imgflip.com/30b1gx.jpg');
    expect(img.alt).toBe('Drake Hotline Bling');
  });

  it('renders the template name as a visible label', () => {
    expect(getVisibleNames(dom.results)).toEqual([
      'Drake Hotline Bling',
      'Distracted Boyfriend',
      'Two Buttons',
      'LeBron Funny',
      'TAJ Weird Smile'
    ]);
  });

  it('clears the status message once results are rendered', () => {
    expect(dom.status.textContent).toBe('');
  });

  it('resolves internal template image paths relative to the page and encodes spaces', () => {
    dom.input.value = 'weird smile';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    const img = dom.results.querySelector('.meme-search-card img');

    expect(img.getAttribute('src')).toBe(
      '../assets/templates/TAJ-meme-templates/TAJ-weird%20smile.webp'
    );
  });
});

// ── Filtering ─────────────────────────────────────────────────────────────────

describe('Meme Search — filtering', () => {
  let dom;
  let MemeSearch;

  beforeEach(async () => {
    dom = mountSearchDom();

    global.fetch = mockFetchByUrl({
      imgflip: makeImgflipPayload(),
      templates: makeTemplatesPayload()
    });

    MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status
    });

    await waitForAsyncRender();
  });

  it('shows all memes when the search query is empty', () => {
    expect(dom.results.querySelectorAll('.meme-search-card')).toHaveLength(5);
  });

  it('filters API memes by template name on Enter', () => {
    dom.input.value = 'drake';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(getVisibleNames(dom.results)).toEqual(['Drake Hotline Bling']);
  });

  it('filters case-insensitively', () => {
    dom.input.value = 'BoYfRiEnD';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(getVisibleNames(dom.results)).toEqual(['Distracted Boyfriend']);
  });

  it('filters internal templates by name', () => {
    dom.input.value = 'lebron';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(getVisibleNames(dom.results)).toEqual(['LeBron Funny']);
  });

  it('filters internal templates by character metadata', () => {
    dom.input.value = 'taj';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(getVisibleNames(dom.results)).toEqual(['TAJ Weird Smile']);
  });

  it('filters internal templates by emotion metadata', () => {
    dom.input.value = 'funny';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(getVisibleNames(dom.results)).toContain('LeBron Funny');
  });

  it('filters internal templates by tag metadata', () => {
    dom.input.value = 'basketball';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(getVisibleNames(dom.results)).toEqual(['LeBron Funny']);
  });

  it('filters as the user types after the debounce delay', async () => {
    dom.input.value = 'drake';
    dom.input.dispatchEvent(new Event('input'));

    await wait(200);

    expect(getVisibleNames(dom.results)).toEqual(['Drake Hotline Bling']);
  });

  it('shows a no-matches message when nothing matches', () => {
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

    expect(dom.results.querySelectorAll('.meme-search-card')).toHaveLength(5);
  });
});

// ── onSelect callback ─────────────────────────────────────────────────────────

describe('Meme Search — onSelect callback', () => {
  it('invokes onSelect with the full API meme record when a card is clicked', async () => {
    const dom = mountSearchDom();
    const onSelect = jest.fn();

    global.fetch = mockFetchByUrl({
      imgflip: makeImgflipPayload(),
      templates: makeTemplatesPayload()
    });

    jest.spyOn(window, 'scrollTo').mockImplementation(() => {});

    const MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status,
      onSelect
    });

    await waitForAsyncRender();

    const firstCard = dom.results.querySelector('.meme-search-card');

    firstCard.click();

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '181913649',
        name: 'Drake Hotline Bling',
        url: 'https://i.imgflip.com/30b1gx.jpg'
      })
    );
  });

  it('passes the resolved internal template URL to onSelect when clicked', async () => {
    const dom = mountSearchDom();
    const onSelect = jest.fn();

    global.fetch = mockFetchByUrl({
      imgflip: makeImgflipPayload(),
      templates: makeTemplatesPayload()
    });

    jest.spyOn(window, 'scrollTo').mockImplementation(() => {});

    const MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status,
      onSelect
    });

    await waitForAsyncRender();

    dom.input.value = 'lebron';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    dom.results.querySelector('.meme-search-card').click();

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'lebron-funny',
        name: 'LeBron Funny',
        url: '../assets/templates/lebron-meme-templates/lebron-funny.jpg'
      })
    );
  });

  it('does not throw when no onSelect was provided and a card is clicked', async () => {
    const dom = mountSearchDom();

    global.fetch = mockFetchByUrl({
      imgflip: makeImgflipPayload(),
      templates: []
    });

    jest.spyOn(window, 'scrollTo').mockImplementation(() => {});

    const MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status
    });

    await waitForAsyncRender();

    const firstCard = dom.results.querySelector('.meme-search-card');

    expect(() => firstCard.click()).not.toThrow();
  });

  it('scrolls back to the top when a card is clicked', async () => {
    const dom = mountSearchDom();

    global.fetch = mockFetchByUrl({
      imgflip: makeImgflipPayload(),
      templates: []
    });

    const scrollSpy = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});

    const MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status
    });

    await waitForAsyncRender();

    const firstCard = dom.results.querySelector('.meme-search-card');

    firstCard.click();

    expect(scrollSpy).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
  });
});

// ── Internal-library fallback ─────────────────────────────────────────────────

describe('Meme Search — internal library fallback', () => {
  it('falls back to internal templates when the Imgflip API network request fails', async () => {
    const dom = mountSearchDom();

    global.fetch = mockFetchByUrl({
      imgflip: new Error('network down'),
      templates: makeTemplatesPayload()
    });

    const MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status
    });

    await waitForAsyncRender();

    expect(getVisibleNames(dom.results)).toEqual(['LeBron Funny', 'TAJ Weird Smile']);
    expect(dom.status.textContent).not.toMatch(/could not load memes/i);
  });

  it('falls back to internal templates when Imgflip returns non-2xx', async () => {
    const dom = mountSearchDom();

    global.fetch = mockFetchByUrlWithStatus({
      imgflip: {
        ok: false,
        status: 503,
        body: {}
      },
      templates: {
        ok: true,
        status: 200,
        body: makeTemplatesPayload()
      }
    });

    const MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status
    });

    await waitForAsyncRender();

    expect(getVisibleNames(dom.results)).toEqual(['LeBron Funny', 'TAJ Weird Smile']);
    expect(dom.status.textContent).not.toMatch(/could not load memes/i);
  });

  it('falls back to internal templates when Imgflip payload is malformed', async () => {
    const dom = mountSearchDom();

    global.fetch = mockFetchByUrl({
      imgflip: {
        success: true,
        data: {}
      },
      templates: makeTemplatesPayload()
    });

    const MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status
    });

    await waitForAsyncRender();

    expect(getVisibleNames(dom.results)).toEqual(['LeBron Funny', 'TAJ Weird Smile']);
    expect(dom.status.textContent).not.toMatch(/could not load memes/i);
  });

  it('still allows internal fallback memes to be selected', async () => {
    const dom = mountSearchDom();
    const onSelect = jest.fn();

    global.fetch = mockFetchByUrl({
      imgflip: new Error('network down'),
      templates: makeTemplatesPayload()
    });

    jest.spyOn(window, 'scrollTo').mockImplementation(() => {});

    const MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status,
      onSelect
    });

    await waitForAsyncRender();

    dom.results.querySelector('.meme-search-card').click();

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'lebron-funny',
        name: 'LeBron Funny'
      })
    );
  });
});

// ── Error and empty states ────────────────────────────────────────────────────

describe('Meme Search — error and empty states', () => {
  it('shows a no-memes message when both Imgflip and local templates fail', async () => {
    const dom = mountSearchDom();

    global.fetch = mockFetchReject(new Error('network down'));

    const MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status
    });

    await waitForAsyncRender();

    expect(dom.results.children).toHaveLength(0);
    expect(dom.status.textContent).toMatch(/could not load any memes/i);
  });

  it('shows a no-memes message when Imgflip returns non-2xx and local templates fail', async () => {
    const dom = mountSearchDom();

    global.fetch = mockFetchByUrlWithStatus({
      imgflip: {
        ok: false,
        status: 503,
        body: {}
      },
      templates: new Error('local down')
    });

    const MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status
    });

    await waitForAsyncRender();

    expect(dom.results.children).toHaveLength(0);
    expect(dom.status.textContent).toMatch(/could not load any memes/i);
  });

  it('shows a no-memes message when Imgflip payload is malformed and local templates fail', async () => {
    const dom = mountSearchDom();

    global.fetch = mockFetchByUrl({
      imgflip: {
        success: true,
        data: {}
      },
      templates: new Error('local down')
    });

    const MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status
    });

    await waitForAsyncRender();

    expect(dom.results.children).toHaveLength(0);
    expect(dom.status.textContent).toMatch(/could not load any memes/i);
  });

  it('shows a no-memes message when both sources return empty arrays', async () => {
    const dom = mountSearchDom();

    global.fetch = mockFetchByUrl({
      imgflip: {
        success: true,
        data: {
          memes: []
        }
      },
      templates: []
    });

    const MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status
    });

    await waitForAsyncRender();

    expect(dom.results.children).toHaveLength(0);
    expect(dom.status.textContent).toMatch(/could not load any memes/i);
  });

  it('does not break if local templates return a non-array payload', async () => {
    const dom = mountSearchDom();

    global.fetch = mockFetchByUrl({
      imgflip: makeImgflipPayload(),
      templates: {
        templates: 'not an array'
      }
    });

    const MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status
    });

    await waitForAsyncRender();

    expect(getVisibleNames(dom.results)).toEqual([
      'Drake Hotline Bling',
      'Distracted Boyfriend',
      'Two Buttons'
    ]);
    expect(dom.status.textContent).toBe('');
  });

  it('does not break if local templates return non-2xx', async () => {
    const dom = mountSearchDom();

    global.fetch = mockFetchByUrlWithStatus({
      imgflip: {
        ok: true,
        status: 200,
        body: makeImgflipPayload()
      },
      templates: {
        ok: false,
        status: 404,
        body: {}
      }
    });

    const MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status
    });

    await waitForAsyncRender();

    expect(getVisibleNames(dom.results)).toEqual([
      'Drake Hotline Bling',
      'Distracted Boyfriend',
      'Two Buttons'
    ]);
    expect(dom.status.textContent).toBe('');
  });
});

// ── loadFromUrl() ─────────────────────────────────────────────────────────────

describe('Meme Search — loadFromUrl()', () => {
  it('fetches the URL as a Blob and pipes it to ImageLoader.loadFromFile', async () => {
    const fakeBlob = new Blob(['fake-bytes'], { type: 'image/jpeg' });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(fakeBlob)
    });

    const MemeSearch = loadFreshMemeSearch({ withImageLoader: true });

    MemeSearch.loadFromUrl('https://i.imgflip.com/30b1gx.jpg', jest.fn());

    await waitForAsyncRender();

    expect(global.fetch).toHaveBeenCalledWith('https://i.imgflip.com/30b1gx.jpg', {
      mode: 'cors'
    });

    expect(window.MemeGen.ImageLoader.loadFromFile).toHaveBeenCalledWith(fakeBlob);
  });

  it('calls onError when the fetch fails', async () => {
    global.fetch = mockFetchReject(new Error('CORS blocked'));

    const onError = jest.fn();
    const MemeSearch = loadFreshMemeSearch({ withImageLoader: true });

    MemeSearch.loadFromUrl('https://i.imgflip.com/30b1gx.jpg', onError);

    await waitForAsyncRender();

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
    const MemeSearch = loadFreshMemeSearch({ withImageLoader: true });

    MemeSearch.loadFromUrl('https://i.imgflip.com/missing.jpg', onError);

    await waitForAsyncRender();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toMatch(/404/);
  });

  it('does not throw when onError is omitted and the fetch fails', async () => {
    global.fetch = mockFetchReject(new Error('boom'));

    const MemeSearch = loadFreshMemeSearch({ withImageLoader: true });

    expect(() => {
      MemeSearch.loadFromUrl('https://i.imgflip.com/30b1gx.jpg');
    }).not.toThrow();

    await waitForAsyncRender();
  });
});

// ── Imgflip alias tagging ─────────────────────────────────────────────────────

describe('Meme Search — Imgflip alias tagging', () => {
  let dom;
  let MemeSearch;

  beforeEach(async () => {
    dom = mountSearchDom();

    global.fetch = mockFetchByUrl({
      imgflip: makeImgflipPayload(),
      templates: []
    });

    MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status
    });

    await waitForAsyncRender();
  });

  function search(term) {
    dom.input.value = term;
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    return getVisibleNames(dom.results);
  }

  it('matches Distracted Boyfriend by the alias "cheating"', () => {
    expect(search('cheating')).toContain('Distracted Boyfriend');
  });

  it('matches Drake Hotline Bling by the alias "reject"', () => {
    expect(search('reject')).toContain('Drake Hotline Bling');
  });

  it('matches Two Buttons by the alias "dilemma"', () => {
    expect(search('dilemma')).toContain('Two Buttons');
  });

  it('still matches by the original template name', () => {
    expect(search('drake')).toContain('Drake Hotline Bling');
  });

  it('is case-insensitive across alias keywords', () => {
    expect(search('CHEATING')).toContain('Distracted Boyfriend');
  });

  it('returns nothing for an alias that no template uses', () => {
    expect(search('photosynthesis')).toEqual([]);
  });

  it('matches multiple memes that share an emotion tag', () => {
    expect(search('thoughtful').sort()).toEqual(
      ['Drake Hotline Bling', 'Two Buttons'].sort()
    );
  });

  it('matches multiple memes for a worry-family emotion', () => {
    expect(search('worried').sort()).toEqual(
      ['Distracted Boyfriend', 'Two Buttons'].sort()
    );
  });
});

// ── Alias coverage guard ──────────────────────────────────────────────────────

describe('Meme Search — emotion-tag coverage', () => {
  const REQUIRED_EMOTIONS = [
    'happy',
    'sad',
    'angry',
    'scared',
    'surprised',
    'disgusted',
    'confused',
    'nervous',
    'excited',
    'bored',
    'calm',
    'embarrassed',
    'proud',
    'jealous',
    'lonely',
    'hopeful',
    'disappointed',
    'frustrated',
    'relaxed',
    'worried',
    'heartbroken',
    'devastated',
    'furious',
    'terrified',
    'shocked',
    'overwhelmed',
    'exhausted',
    'stressed',
    'anxious',
    'panicked',
    'miserable',
    'joyful',
    'ecstatic',
    'peaceful',
    'emotional',
    'crying',
    'laughing',
    'screaming',
    'thoughtful',
    'serious',
    'shy',
    'awkward',
    'annoyed',
    'suspicious',
    'curious',
    'playful',
    'confident',
    'insecure',
    'guilty',
    'grateful',
    'nostalgic',
    'romantic',
    'dreamy',
    'bittersweet',
    'determined',
    'relieved',
    'uncomfortable'
  ];

  function loadAliasMap() {
    const fs = require('fs');
    const path = require('path');

    const src = fs.readFileSync(
      path.join(__dirname, '..', 'meme-app', 'js', 'MemeSearch.js'),
      'utf8'
    );

    const start = src.indexOf('var IMGFLIP_ALIASES =');
    const open = src.indexOf('{', start);
    const close = src.indexOf('};', open);

    // eslint-disable-next-line no-new-func
    return Function('return (' + src.slice(open, close + 1) + ');')();
  }

  it('tags each required emotion word on at least 10 templates', () => {
    const aliases = loadAliasMap();
    const allEntries = Object.values(aliases);

    expect(allEntries.length).toBeGreaterThanOrEqual(90);

    const under = [];

    REQUIRED_EMOTIONS.forEach((word) => {
      const hits = allEntries.filter((list) => list.includes(word)).length;

      if (hits < 10) {
        under.push(`${word}=${hits}`);
      }
    });

    expect(under).toEqual([]);
  });
});
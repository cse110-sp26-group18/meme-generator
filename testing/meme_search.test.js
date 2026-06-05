/**
 * meme_search.test.js
 *
 * Verifies MemeSearch / Joint Library behavior.
 *
 * Covers:
 *  - Required search UI elements exist in the DOM
 *  - init() wires input and fetches Imgflip + tag file + internal library
 *  - Focus after init does not start a second fetch
 *  - Imgflip/open-source API memes load as the primary source
 *  - Internal templates from templates.json are merged into the same grid
 *  - Search works across API names, legacy file-supplied tags, and internal metadata
 *  - Imgflip tags come from localStorage, then the Worker, with imgflip-tags.json
 *    as a fallback when cloud tagging is disabled
 *  - A failed tag file / throwing localStorage still renders memes (name search)
 *  - Internal memes are searchable by name, character, emotion, and tags
 *  - If Imgflip fails, internal templates still render as fallback
 *  - If both sources fail/return empty, the UI shows "Could not load any memes."
 *  - Clicking a card invokes onSelect with the full meme record
 *  - loadFromUrl() fetches the URL as a Blob and pipes it to loadFromFile
 *  - The migrated imgflip-tags.json covers the required emotion vocabulary
 *
 * jsdom notes:
 *  - jsdom does not implement fetch, so global.fetch is stubbed per test with a
 *    URL-aware router (memes, tag file, and internal library load together).
 *  - MemeSearch.js is an IIFE with private cache state.
 *    jest.resetModules() + re-require keeps every test isolated.
 *  - Cloud (Worker) tagging stays disabled unless init() receives an
 *    aiTagEndpoint or window.MemeGenConfig.aiTagEndpoint is set.
 *  - Cards are image-only (the name lives in img.alt + the button title), so
 *    rendered names are read from img.alt.
 *
 * Module under test: meme-app/js/MemeSearch.js
 */

const MEME_SEARCH_PATH = '../meme-app/js/MemeSearch.js';
const IMGFLIP_URL = 'https://api.imgflip.com/get_memes';
const TAGS_URL = '../assets/templates/imgflip-tags.json';
const TEMPLATES_URL = '../assets/templates/templates.json';
const LOCAL_TAG_CACHE_KEY = 'memeSearch.imgflipTags.v2';

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

// URL-aware fetch stub. init() fetches three sources in parallel: the Imgflip
// list, the imgflip-tags.json file, and the internal library. Each can be a
// payload or an Error (to simulate a network failure).
function mockFetchByUrl({ imgflip, templates, tags = {} }) {
  return jest.fn((url) => {
    if (url === IMGFLIP_URL) {
      if (imgflip instanceof Error) return Promise.reject(imgflip);
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(imgflip) });
    }

    if (url === TAGS_URL) {
      if (tags instanceof Error) return Promise.reject(tags);
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(tags) });
    }

    if (url === TEMPLATES_URL) {
      if (templates instanceof Error) return Promise.reject(templates);
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(templates) });
    }

    return Promise.reject(new Error('Unknown URL: ' + url));
  });
}

// Same idea, but lets each source specify its own { ok, status, body }.
function mockFetchByUrlWithStatus({ imgflip, templates, tags }) {
  const tagsCfg = tags || { ok: true, status: 200, body: {} };
  return jest.fn((url) => {
    if (url === IMGFLIP_URL) {
      if (imgflip instanceof Error) return Promise.reject(imgflip);
      return Promise.resolve({ ok: imgflip.ok, status: imgflip.status, json: () => Promise.resolve(imgflip.body) });
    }

    if (url === TAGS_URL) {
      if (tagsCfg instanceof Error) return Promise.reject(tagsCfg);
      return Promise.resolve({ ok: tagsCfg.ok, status: tagsCfg.status, json: () => Promise.resolve(tagsCfg.body) });
    }

    if (url === TEMPLATES_URL) {
      if (templates instanceof Error) return Promise.reject(templates);
      return Promise.resolve({ ok: templates.ok, status: templates.status, json: () => Promise.resolve(templates.body) });
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

// Cards are image-only; the template name lives in each card image's alt text.
function getVisibleNames(resultsEl) {
  return Array.from(resultsEl.querySelectorAll('.meme-search-card img')).map((img) => img.alt);
}

function setLocalTagCache(map) {
  window.localStorage.setItem(LOCAL_TAG_CACHE_KEY, JSON.stringify(map));
}

// ── Per-test cleanup ──────────────────────────────────────────────────────────

afterEach(() => {
  document.body.innerHTML = '';
  jest.restoreAllMocks();
  delete global.fetch;
  delete global.MemeGen;
  delete window.MemeGen;
  delete window.MemeGenConfig;
  try {
    window.localStorage.clear();
  } catch (e) {
    /* ignore */
  }
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
  it('starts fetching every source during init before the input is focused', () => {
    const dom = mountSearchDom();

    global.fetch = mockFetchByUrl({
      imgflip: makeImgflipPayload(),
      templates: makeTemplatesPayload(),
      tags: {
        '181913649': { name: 'Drake Hotline Bling', tags: ['relaxed', 'choice', 'excited'] },
        '112126428': { name: 'Distracted Boyfriend', tags: ['sad', 'disappointed', 'unhappy'] },
        '4087833': { name: 'Waiting Skeleton', tags: ['waiting', 'tired', 'sad'] },
        '87743020': { name: 'Two Buttons', tags: ['worried', 'dilemma', 'tired'] }
      }
    });

    const MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status
    });

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(global.fetch).toHaveBeenCalledWith(IMGFLIP_URL);
    expect(global.fetch).toHaveBeenCalledWith(TAGS_URL);
    expect(global.fetch).toHaveBeenCalledWith(TEMPLATES_URL);
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
      templates: makeTemplatesPayload(),
      tags: {
        '181913649': { name: 'Drake Hotline Bling', tags: ['relaxed', 'choice', 'excited', 'sadistic', 'made'] },
        '112126428': { name: 'Distracted Boyfriend', tags: ['sad', 'disappointed', 'unhappy'] },
        '4087833': { name: 'Waiting Skeleton', tags: ['waiting', 'tired', 'sad'] },
        '87743020': { name: 'Two Buttons', tags: ['worried', 'dilemma', 'tired', 'mad'] }
      }
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

    // Init triggers the three fetches; later focus is a no-op (fetched === true).
    expect(global.fetch).toHaveBeenCalledTimes(3);
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
    expect(getVisibleNames(dom.results)).toEqual([
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

  it('exposes the template name on the card button title for accessibility', () => {
    const titles = Array.from(dom.results.querySelectorAll('.meme-search-card')).map(
      (card) => card.title
    );

    expect(titles).toEqual([
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
      templates: makeTemplatesPayload(),
      tags: {
        '181913649': { name: 'Drake Hotline Bling', tags: ['relaxed', 'choice', 'excited', 'sadistic', 'made'] },
        '112126428': { name: 'Distracted Boyfriend', tags: ['sad', 'disappointed', 'unhappy'] },
        '4087833': { name: 'Waiting Skeleton', tags: ['waiting', 'tired', 'sad'] },
        '87743020': { name: 'Two Buttons', tags: ['worried', 'dilemma', 'tired', 'mad'] }
      }
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

  it('expands emotion search queries to related tag synonyms', () => {
    dom.input.value = 'nervous';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(getVisibleNames(dom.results)).toEqual(['Two Buttons']);
  });

  it('expands additional common emotion queries', () => {
    dom.input.value = 'calm';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(getVisibleNames(dom.results)).toEqual(['Drake Hotline Bling']);

    dom.input.value = 'bored';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(getVisibleNames(dom.results)).toEqual(['Two Buttons']);

    dom.input.value = 'stress';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(getVisibleNames(dom.results)).toEqual(['Two Buttons']);

    dom.input.value = 'stressed';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(getVisibleNames(dom.results)).toEqual(['Two Buttons']);

    dom.input.value = 'worry';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(getVisibleNames(dom.results)).toEqual(['Two Buttons']);
  });

  it('expands common phrase searches into emotion and reaction tags', () => {
    dom.input.value = 'so sad';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(getVisibleNames(dom.results)).toEqual(['Distracted Boyfriend']);

    dom.input.value = 'lets go';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(getVisibleNames(dom.results)).toEqual(['Drake Hotline Bling']);

    dom.input.value = 'I am stressed';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(getVisibleNames(dom.results)).toEqual(['Two Buttons']);
  });

  it('does not match emotion terms inside opposite words', () => {
    dom.input.value = 'happy';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(getVisibleNames(dom.results)).toEqual(['Drake Hotline Bling']);

    dom.input.value = 'sad';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(getVisibleNames(dom.results)).toEqual(['Distracted Boyfriend']);

    dom.input.value = 'mad';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(getVisibleNames(dom.results)).toEqual(['Two Buttons']);
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

// ── Tags from the committed tag file ──────────────────────────────────────────

describe('Meme Search — tags from imgflip-tags.json', () => {
  let dom;

  beforeEach(async () => {
    dom = mountSearchDom();

    global.fetch = mockFetchByUrl({
      imgflip: makeImgflipPayload(),
      templates: [],
      tags: {
        '181913649': { name: 'Drake Hotline Bling', tags: ['reject', 'thoughtful'] },
        '112126428': { name: 'Distracted Boyfriend', tags: ['cheating', 'betrayal', 'worried'] },
        '87743020': { name: 'Two Buttons', tags: ['dilemma', 'thoughtful', 'worried'] }
      }
    });

    const MemeSearch = loadFreshMemeSearch();

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

  it('matches a meme by a tag that is not part of its name', () => {
    expect(search('cheating')).toEqual(['Distracted Boyfriend']);
  });

  it('matches Drake by the tag "reject"', () => {
    expect(search('reject')).toEqual(['Drake Hotline Bling']);
  });

  it('matches Two Buttons by the tag "dilemma"', () => {
    expect(search('dilemma')).toEqual(['Two Buttons']);
  });

  it('still matches by the original template name', () => {
    expect(search('drake')).toEqual(['Drake Hotline Bling']);
  });

  it('is case-insensitive across tag keywords', () => {
    expect(search('CHEATING')).toEqual(['Distracted Boyfriend']);
  });

  it('returns nothing for a tag that no template uses', () => {
    expect(search('photosynthesis')).toEqual([]);
  });

  it('matches multiple memes that share a tag', () => {
    expect(search('thoughtful').sort()).toEqual(
      ['Drake Hotline Bling', 'Two Buttons'].sort()
    );
  });

  it('matches multiple memes for a worry-family tag', () => {
    expect(search('worried').sort()).toEqual(
      ['Distracted Boyfriend', 'Two Buttons'].sort()
    );
  });
});

// ── Tags from the localStorage cache ──────────────────────────────────────────

describe('Meme Search — tags from the localStorage cache', () => {
  it('matches a meme by a tag cached in localStorage', async () => {
    const dom = mountSearchDom();
    setLocalTagCache({ '112126428': ['cheating', 'betrayal'] });

    global.fetch = mockFetchByUrl({ imgflip: makeImgflipPayload(), templates: [], tags: {} });

    const MemeSearch = loadFreshMemeSearch();
    MemeSearch.init({ input: dom.input, results: dom.results, status: dom.status });
    await waitForAsyncRender();

    dom.input.value = 'betrayal';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(getVisibleNames(dom.results)).toEqual(['Distracted Boyfriend']);
  });

  it('prefers the localStorage cache over the legacy committed tag file', async () => {
    const dom = mountSearchDom();
    setLocalTagCache({ '181913649': ['localstorageonly'] });

    global.fetch = mockFetchByUrl({
      imgflip: makeImgflipPayload(),
      templates: [],
      tags: { '181913649': { name: 'Drake Hotline Bling', tags: ['approve'] } }
    });

    const MemeSearch = loadFreshMemeSearch();
    MemeSearch.init({ input: dom.input, results: dom.results, status: dom.status });
    await waitForAsyncRender();

    dom.input.value = 'approve';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(getVisibleNames(dom.results)).toEqual([]);

    dom.input.value = 'localstorageonly';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(getVisibleNames(dom.results)).toEqual(['Drake Hotline Bling']);
  });
});

// ── Tags from the cloud Worker ────────────────────────────────────────────────

describe('Meme Search — tags from the cloud Worker', () => {
  const WORKER_URL = 'https://tag-meme-worker.example.workers.dev/tag-meme';

  function mockFetchWithWorkerTags(tagsById) {
    return jest.fn((url, options = {}) => {
      if (url === IMGFLIP_URL) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            data: {
              memes: [makeImgflipPayload().data.memes[0]]
            }
          })
        });
      }

      if (url === TAGS_URL) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
      }

      if (url === TEMPLATES_URL) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
      }

      if (url === WORKER_URL) {
        const body = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ tags: tagsById[body.id] || [] })
        });
      }

      return Promise.reject(new Error('Unknown URL: ' + url));
    });
  }

  it('does not call the Worker when no endpoint is configured', async () => {
    const dom = mountSearchDom();

    global.fetch = mockFetchWithWorkerTags({
      '181913649': ['approve']
    });

    const MemeSearch = loadFreshMemeSearch();
    MemeSearch.init({ input: dom.input, results: dom.results, status: dom.status });
    await waitForAsyncRender();

    expect(global.fetch).not.toHaveBeenCalledWith(
      WORKER_URL,
      expect.any(Object)
    );
  });

  it('calls the configured Worker for untagged Imgflip memes and updates search results', async () => {
    const dom = mountSearchDom();

    global.fetch = mockFetchWithWorkerTags({
      '181913649': ['approve', 'reaction']
    });

    const MemeSearch = loadFreshMemeSearch();
    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status,
      aiTagEndpoint: WORKER_URL
    });
    await waitForAsyncRender();

    expect(global.fetch).toHaveBeenCalledWith(
      WORKER_URL,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"id":"181913649"')
      })
    );

    await waitForAsyncRender();

    dom.input.value = 'approve';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(getVisibleNames(dom.results)).toEqual(['Drake Hotline Bling']);
    expect(JSON.parse(window.localStorage.getItem(LOCAL_TAG_CACHE_KEY))).toEqual(
      expect.objectContaining({
        '181913649': ['approve', 'reaction']
      })
    );
  });

  it('ignores legacy committed tags when a Worker endpoint is configured', async () => {
    const dom = mountSearchDom();

    global.fetch = mockFetchWithWorkerTags({
      '181913649': ['worker-only']
    });

    const MemeSearch = loadFreshMemeSearch();
    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status,
      aiTagEndpoint: WORKER_URL
    });
    await waitForAsyncRender();

    expect(global.fetch).toHaveBeenCalledWith(
      WORKER_URL,
      expect.objectContaining({
        method: 'POST'
      })
    );
  });

  it('refreshes from the Worker even when older localStorage tags exist', async () => {
    const dom = mountSearchDom();
    setLocalTagCache({ '181913649': ['old-local-tag'] });

    global.fetch = mockFetchWithWorkerTags({
      '181913649': ['nervous', 'updated']
    });

    const MemeSearch = loadFreshMemeSearch();
    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status,
      aiTagEndpoint: WORKER_URL
    });
    await waitForAsyncRender();

    expect(global.fetch).toHaveBeenCalledWith(
      WORKER_URL,
      expect.objectContaining({
        method: 'POST'
      })
    );
  });

  it('can read the Worker endpoint from window.MemeGenConfig', async () => {
    const dom = mountSearchDom();
    window.MemeGenConfig = { aiTagEndpoint: WORKER_URL };

    global.fetch = mockFetchWithWorkerTags({
      '181913649': ['approve']
    });

    const MemeSearch = loadFreshMemeSearch();
    MemeSearch.init({ input: dom.input, results: dom.results, status: dom.status });
    await waitForAsyncRender();

    expect(global.fetch).toHaveBeenCalledWith(
      WORKER_URL,
      expect.any(Object)
    );
  });
});

// ── Tag-source failures degrade gracefully ────────────────────────────────────

describe('Meme Search — tag-source failures degrade gracefully', () => {
  it('still renders memes (name search) when the tag file 404s', async () => {
    const dom = mountSearchDom();

    global.fetch = mockFetchByUrlWithStatus({
      imgflip: { ok: true, status: 200, body: makeImgflipPayload() },
      templates: { ok: true, status: 200, body: [] },
      tags: { ok: false, status: 404, body: {} }
    });

    const MemeSearch = loadFreshMemeSearch();
    MemeSearch.init({ input: dom.input, results: dom.results, status: dom.status });
    await waitForAsyncRender();

    expect(dom.results.querySelectorAll('.meme-search-card')).toHaveLength(3);

    dom.input.value = 'two buttons';
    dom.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(getVisibleNames(dom.results)).toEqual(['Two Buttons']);
  });

  it('still renders memes when the tag file network request fails', async () => {
    const dom = mountSearchDom();

    global.fetch = mockFetchByUrl({
      imgflip: makeImgflipPayload(),
      templates: [],
      tags: new Error('tags down')
    });

    const MemeSearch = loadFreshMemeSearch();
    MemeSearch.init({ input: dom.input, results: dom.results, status: dom.status });
    await waitForAsyncRender();

    expect(dom.results.querySelectorAll('.meme-search-card')).toHaveLength(3);
  });

  it('still renders memes when localStorage throws', async () => {
    const dom = mountSearchDom();
    const getItemSpy = jest
      .spyOn(window.localStorage.__proto__, 'getItem')
      .mockImplementation(() => {
        throw new Error('localStorage blocked');
      });

    global.fetch = mockFetchByUrl({ imgflip: makeImgflipPayload(), templates: [], tags: {} });

    const MemeSearch = loadFreshMemeSearch();
    MemeSearch.init({ input: dom.input, results: dom.results, status: dom.status });
    await waitForAsyncRender();

    expect(dom.results.querySelectorAll('.meme-search-card')).toHaveLength(3);
    getItemSpy.mockRestore();
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
    expect(dom.status.textContent).not.toMatch(/could not load any memes/i);
  });

  it('falls back to internal templates when Imgflip returns non-2xx', async () => {
    const dom = mountSearchDom();

    global.fetch = mockFetchByUrlWithStatus({
      imgflip: { ok: false, status: 503, body: {} },
      templates: { ok: true, status: 200, body: makeTemplatesPayload() }
    });

    const MemeSearch = loadFreshMemeSearch();

    MemeSearch.init({
      input: dom.input,
      results: dom.results,
      status: dom.status
    });

    await waitForAsyncRender();

    expect(getVisibleNames(dom.results)).toEqual(['LeBron Funny', 'TAJ Weird Smile']);
    expect(dom.status.textContent).not.toMatch(/could not load any memes/i);
  });

  it('falls back to internal templates when Imgflip payload is malformed', async () => {
    const dom = mountSearchDom();

    global.fetch = mockFetchByUrl({
      imgflip: { success: true, data: {} },
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
    expect(dom.status.textContent).not.toMatch(/could not load any memes/i);
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
      imgflip: { ok: false, status: 503, body: {} },
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
      imgflip: { success: true, data: {} },
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
      imgflip: { success: true, data: { memes: [] } },
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
      templates: { templates: 'not an array' }
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
      imgflip: { ok: true, status: 200, body: makeImgflipPayload() },
      templates: { ok: false, status: 404, body: {} }
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

// ── Tag-file emotion coverage guard ───────────────────────────────────────────
//
// The Imgflip tags now live in assets/templates/imgflip-tags.json (migrated out
// of MemeSearch.js). This guard validates the migrated data still covers the
// emotion vocabulary the search experience relies on.

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

  function loadTagLists() {
    const fs = require('fs');
    const path = require('path');

    const raw = fs.readFileSync(
      path.join(__dirname, '..', 'assets', 'templates', 'imgflip-tags.json'),
      'utf8'
    );

    const map = JSON.parse(raw);
    return Object.values(map).map((entry) => entry.tags);
  }

  it('tags each required emotion word on at least 10 templates', () => {
    const allEntries = loadTagLists();

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

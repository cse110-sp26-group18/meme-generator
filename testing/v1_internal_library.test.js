/**
 * v1_internal_library.test.js
 * Verifies the Internal Meme Template Library feature.
 *
 * Covers:
 *  - Fetching templates.json from the path relative to meme-app/index.html
 *  - Card rendering: image-only, with an accessible aria-label
 *  - Search filter (name, character, emotion, tags)
 *  - Category dropdown population and filtering
 *  - Click + keyboard activation invoking the onSelect callback
 *  - URI encoding for filenames that contain spaces
 *  - Error handling when templates.json fails to load
 *
 * Module under test: meme-app/js/TemplateLibrary.js
 *
 * jsdom note: jsdom does not provide global fetch. Each test stubs
 * `global.fetch` with a promise resolving to the test's template fixture, then
 * flushes microtasks before asserting on the rendered DOM.
 */

const TemplateLibrary = window.MemeGen.TemplateLibrary;

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const SAMPLE = [
  {
    id: 'lebron-happy',
    name: 'LeBron Happy',
    character: 'LeBron',
    emotion: 'happy',
    category: 'sports',
    tags: ['sports', 'basketball', 'lebron', 'happy'],
    image: 'assets/templates/lebron-meme-templates/lebron-happy.jpg',
    textBoxes: []
  },
  {
    id: 'lebron-sad',
    name: 'LeBron Sad',
    character: 'LeBron',
    emotion: 'sad',
    category: 'sports',
    tags: ['sports', 'basketball', 'lebron', 'sad'],
    image: 'assets/templates/lebron-meme-templates/lebron-sad.jpg',
    textBoxes: []
  },
  {
    id: 'spongebob-mocking',
    name: 'SpongeBob Mocking',
    character: 'SpongeBob',
    emotion: 'mocking',
    category: 'animation',
    tags: ['animation', 'spongebob', 'mocking'],
    image: 'assets/templates/spongebob-meme-templates/spongebob-mocking.jpg',
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

function buildDom() {
  document.body.innerHTML = `
    <section id="template-library">
      <input id="library-search" type="search">
      <select id="library-category"></select>
      <p id="library-status" hidden></p>
      <div id="library-grid"></div>
    </section>
  `;
}

function stubFetchOk(data) {
  global.fetch = jest.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data)
  }));
}

function stubFetchHttpError(status = 404) {
  global.fetch = jest.fn(() => Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(null)
  }));
}

function stubFetchReject() {
  global.fetch = jest.fn(() => Promise.reject(new Error('network down')));
}

async function initLibrary(data, opts = {}) {
  buildDom();
  if (data !== null) stubFetchOk(data);
  const onSelect = opts.onSelect || jest.fn();
  TemplateLibrary.init({
    gridEl: document.getElementById('library-grid'),
    searchEl: document.getElementById('library-search'),
    categoryEl: document.getElementById('library-category'),
    statusEl: document.getElementById('library-status'),
    onSelect
  });
  // Allow the fetch promise chain to resolve and the grid to render.
  await flushPromises();
  await flushPromises();
  return {
    onSelect,
    grid: document.getElementById('library-grid'),
    search: document.getElementById('library-search'),
    category: document.getElementById('library-category'),
    status: document.getElementById('library-status')
  };
}

// Silence the intentional console.error in the error-path tests so the test
// output stays readable. We restore it after the suite.
let consoleErrorSpy;
beforeAll(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  consoleErrorSpy.mockRestore();
});

afterEach(() => {
  document.body.innerHTML = '';
  jest.clearAllMocks();
});

// ── Module API ───────────────────────────────────────────────────────────────

describe('TemplateLibrary — module surface', () => {
  it('exposes an init function on window.MemeGen.TemplateLibrary', () => {
    expect(typeof TemplateLibrary.init).toBe('function');
  });
});

// ── Fetch path & category dropdown ───────────────────────────────────────────

describe('TemplateLibrary — initialization', () => {
  it('fetches templates.json from the path relative to meme-app/index.html', async () => {
    await initLibrary(SAMPLE);
    expect(global.fetch).toHaveBeenCalledWith('../assets/templates/templates.json');
  });

  it('populates the category dropdown with the documented options in order', async () => {
    const { category } = await initLibrary(SAMPLE);
    const values = Array.from(category.options).map((o) => o.value);
    const labels = Array.from(category.options).map((o) => o.textContent);
    expect(values).toEqual(['all', 'sports', 'animation', 'animals', 'pop-culture']);
    expect(labels).toEqual([
      'All Categories',
      'Sports memes',
      'Animation memes',
      'Animal memes',
      'Pop Culture memes'
    ]);
  });
});

// ── Card rendering ───────────────────────────────────────────────────────────

describe('TemplateLibrary — card rendering', () => {
  it('renders one card per template after a successful fetch', async () => {
    const { grid } = await initLibrary(SAMPLE);
    expect(grid.querySelectorAll('.template-card').length).toBe(SAMPLE.length);
  });

  it('renders only the image inside each card — no visible name or tag badges', async () => {
    const { grid } = await initLibrary(SAMPLE);
    const card = grid.querySelector('.template-card');
    expect(card.querySelector('img')).not.toBeNull();
    expect(card.querySelector('.template-meta')).toBeNull();
    expect(card.querySelector('.template-name')).toBeNull();
    expect(card.querySelector('.template-tags')).toBeNull();
    expect(card.querySelector('.template-tag')).toBeNull();
  });

  it('exposes the card as a button to assistive tech with a label including name, emotion, and category', async () => {
    const { grid } = await initLibrary(SAMPLE);
    const card = grid.querySelector('[data-template-id="lebron-happy"]');
    expect(card.getAttribute('role')).toBe('button');
    expect(card.getAttribute('tabindex')).toBe('0');
    const label = card.getAttribute('aria-label');
    expect(label).toContain('LeBron Happy');
    expect(label).toContain('happy');
    expect(label).toContain('sports');
  });

  it('prefixes the image src with "../" so meme-app/index.html can resolve repo-root paths', async () => {
    const { grid } = await initLibrary(SAMPLE);
    const img = grid.querySelector('[data-template-id="lebron-happy"] img');
    // jsdom resolves to absolute URL — assert via endsWith on the encoded path.
    expect(img.getAttribute('src')).toBe(
      '../assets/templates/lebron-meme-templates/lebron-happy.jpg'
    );
  });

  it('URI-encodes spaces in image filenames so the browser does not fail to load them', async () => {
    const { grid } = await initLibrary(SAMPLE);
    const img = grid.querySelector('[data-template-id="taj-weird-smile"] img');
    expect(img.getAttribute('src')).toBe(
      '../assets/templates/TAJ-meme-templates/TAJ-weird%20smile.webp'
    );
  });
});

// ── Search filter ────────────────────────────────────────────────────────────

describe('TemplateLibrary — search filter', () => {
  function visibleIds(grid) {
    return Array.from(grid.querySelectorAll('.template-card'))
      .map((c) => c.getAttribute('data-template-id'));
  }

  function setSearch(search, value) {
    search.value = value;
    search.dispatchEvent(new Event('input'));
  }

  it('filters by template name (case-insensitive)', async () => {
    const { grid, search } = await initLibrary(SAMPLE);
    setSearch(search, 'SpongeBob');
    expect(visibleIds(grid)).toEqual(['spongebob-mocking']);
  });

  it('filters by character', async () => {
    const { grid, search } = await initLibrary(SAMPLE);
    setSearch(search, 'taj');
    expect(visibleIds(grid)).toEqual(['taj-weird-smile']);
  });

  it('filters by emotion', async () => {
    const { grid, search } = await initLibrary(SAMPLE);
    setSearch(search, 'sad');
    expect(visibleIds(grid)).toEqual(['lebron-sad']);
  });

  it('filters by tag', async () => {
    const { grid, search } = await initLibrary(SAMPLE);
    setSearch(search, 'basketball');
    expect(visibleIds(grid).sort()).toEqual(['lebron-happy', 'lebron-sad']);
  });

  it('shows a status message when the search has no matches', async () => {
    const { grid, search, status } = await initLibrary(SAMPLE);
    setSearch(search, 'nonexistent-keyword');
    expect(grid.querySelectorAll('.template-card').length).toBe(0);
    expect(status.hidden).toBe(false);
    expect(status.textContent).toMatch(/no templates/i);
  });

  it('clearing the search restores all cards', async () => {
    const { grid, search } = await initLibrary(SAMPLE);
    setSearch(search, 'lebron');
    expect(visibleIds(grid).length).toBe(2);
    setSearch(search, '');
    expect(visibleIds(grid).length).toBe(SAMPLE.length);
  });
});

// ── Category filter ──────────────────────────────────────────────────────────

describe('TemplateLibrary — category filter', () => {
  function visibleIds(grid) {
    return Array.from(grid.querySelectorAll('.template-card'))
      .map((c) => c.getAttribute('data-template-id'));
  }

  function setCategory(category, value) {
    category.value = value;
    category.dispatchEvent(new Event('change'));
  }

  it('narrows to one category when a category is selected', async () => {
    const { grid, category } = await initLibrary(SAMPLE);
    setCategory(category, 'animation');
    expect(visibleIds(grid)).toEqual(['spongebob-mocking']);
  });

  it('"all" shows every template', async () => {
    const { grid, category } = await initLibrary(SAMPLE);
    setCategory(category, 'sports');
    expect(visibleIds(grid).length).toBe(2);
    setCategory(category, 'all');
    expect(visibleIds(grid).length).toBe(SAMPLE.length);
  });

  it('combines with the search filter', async () => {
    const { grid, search, category } = await initLibrary(SAMPLE);
    category.value = 'sports';
    category.dispatchEvent(new Event('change'));
    search.value = 'happy';
    search.dispatchEvent(new Event('input'));
    expect(visibleIds(grid)).toEqual(['lebron-happy']);
  });
});

// ── Click & keyboard activation ──────────────────────────────────────────────

describe('TemplateLibrary — selecting a template', () => {
  it('invokes onSelect with the resolved image URL when a card is clicked', async () => {
    const { grid, onSelect } = await initLibrary(SAMPLE);
    const card = grid.querySelector('[data-template-id="lebron-happy"]');
    card.dispatchEvent(new Event('click', { bubbles: true }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    const [url, tmpl] = onSelect.mock.calls[0];
    expect(url).toBe('../assets/templates/lebron-meme-templates/lebron-happy.jpg');
    expect(tmpl.id).toBe('lebron-happy');
  });

  it('activates on Enter when a card has keyboard focus', async () => {
    const { grid, onSelect } = await initLibrary(SAMPLE);
    const card = grid.querySelector('[data-template-id="lebron-happy"]');
    const evt = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    card.dispatchEvent(evt);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('activates on Space and suppresses the browser default scroll', async () => {
    const { grid, onSelect } = await initLibrary(SAMPLE);
    const card = grid.querySelector('[data-template-id="lebron-happy"]');
    const evt = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    card.dispatchEvent(evt);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(evt.defaultPrevented).toBe(true);
  });

  it('ignores unrelated keys', async () => {
    const { grid, onSelect } = await initLibrary(SAMPLE);
    const card = grid.querySelector('[data-template-id="lebron-happy"]');
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});

// ── Error handling ───────────────────────────────────────────────────────────

describe('TemplateLibrary — error handling', () => {
  it('shows a status message and renders no cards when fetch rejects', async () => {
    buildDom();
    stubFetchReject();
    TemplateLibrary.init({
      gridEl: document.getElementById('library-grid'),
      searchEl: document.getElementById('library-search'),
      categoryEl: document.getElementById('library-category'),
      statusEl: document.getElementById('library-status'),
      onSelect: jest.fn()
    });
    await flushPromises();
    await flushPromises();
    const status = document.getElementById('library-status');
    const grid = document.getElementById('library-grid');
    expect(status.hidden).toBe(false);
    expect(status.textContent.length).toBeGreaterThan(0);
    expect(grid.querySelectorAll('.template-card').length).toBe(0);
  });

  it('shows a status message when templates.json returns a non-OK HTTP status', async () => {
    buildDom();
    stubFetchHttpError(404);
    TemplateLibrary.init({
      gridEl: document.getElementById('library-grid'),
      searchEl: document.getElementById('library-search'),
      categoryEl: document.getElementById('library-category'),
      statusEl: document.getElementById('library-status'),
      onSelect: jest.fn()
    });
    await flushPromises();
    await flushPromises();
    const status = document.getElementById('library-status');
    expect(status.hidden).toBe(false);
    expect(status.textContent.length).toBeGreaterThan(0);
  });
});

/**
 * v3_desktop_ai_library.test.js
 *
 * Covers the desktop-only AI library mode (Issues 4 + 5).
 *
 * Verified behavior:
 *  - AISuggestions.init accepts optional onGenerateStart / onGenerated /
 *    onGenerateError callbacks and fires them at the right moments.
 *  - onGenerated receives a normalized {id, name, url, captions}[] list so
 *    the host can render its own cards without duplicating the lookup.
 *  - Existing #ai-results rendering inside the panel still runs (i.e. the
 *    panel and the desktop library co-exist).
 *  - matchMedia('(min-width: 769px)') gates the host's AI library mode
 *    helpers — the same code is safe on mobile because the host opts out.
 *
 * Module under test:
 *  - meme-app/js/AISuggestions.js (extended callbacks)
 *
 * Note on app.js: app.js' DOMContentLoaded wiring is not unit-tested directly
 * here. The helpers (showAiLibraryEmptyState / Loading / renderAiSuggestions /
 * exitAiLibraryMode) are exercised through a small harness that mirrors the
 * production wiring so the desktop library state machine is verified in
 * isolation.
 */

function mountAiDom() {
  document.body.innerHTML = `
    <section class="ai-suggestions">
      <button id="ai-get-btn" type="button">Get AI Suggestions</button>
      <div id="ai-form" hidden>
        <input id="ai-identity">
        <input id="ai-situation">
        <button id="ai-generate-btn" type="button">Generate</button>
        <a id="ai-change-key" href="#" hidden>Change API key</a>
      </div>
      <div id="ai-key-form" hidden>
        <input id="ai-key-input" type="password">
        <button id="ai-key-save-btn" type="button">Save key</button>
      </div>
      <p id="ai-status"></p>
      <div id="ai-results"></div>
      <div id="meme-search-results"></div>
      <input id="meme-search-input" type="text">
      <p id="meme-search-status"></p>
    </section>
  `;
  return {
    root: document.querySelector('.ai-suggestions'),
    getBtn: document.getElementById('ai-get-btn'),
    form: document.getElementById('ai-form'),
    identity: document.getElementById('ai-identity'),
    situation: document.getElementById('ai-situation'),
    generateBtn: document.getElementById('ai-generate-btn'),
    keyForm: document.getElementById('ai-key-form'),
    keyInput: document.getElementById('ai-key-input'),
    keySaveBtn: document.getElementById('ai-key-save-btn'),
    changeKeyLink: document.getElementById('ai-change-key'),
    status: document.getElementById('ai-status'),
    results: document.getElementById('ai-results'),
    libraryResults: document.getElementById('meme-search-results'),
    searchInput: document.getElementById('meme-search-input'),
    searchStatus: document.getElementById('meme-search-status')
  };
}

function flushPromises() {
  return new Promise(function (resolve) { setTimeout(resolve, 0); });
}

const SAMPLE_MEMES = [
  { id: '181913649', name: 'Drake Hotline Bling',  url: 'https://i.imgflip.com/30b1gx.jpg' },
  { id: '112126428', name: 'Distracted Boyfriend', url: 'https://i.imgflip.com/1ur9b0.jpg' },
  { id: '87743020',  name: 'Two Buttons',          url: 'https://i.imgflip.com/1g8my4.jpg' }
];

// Mirror of the small helper set installed by app.js for the desktop library.
// Kept inline so each test sets up its own matchMedia gate and the production
// app.js never has to be booted.
function makeDesktopAiLibrary(refs, isDesktopFn) {
  const isDesktop = isDesktopFn || (() => true);
  let mode = false;
  let suggestions = [];

  function renderBack() {
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'ai-library-back';
    back.id = 'ai-library-back-btn';
    back.textContent = '← Back to templates';
    back.addEventListener('click', exitMode);
    refs.libraryResults.appendChild(back);
  }

  function showEmpty() {
    if (!isDesktop()) return;
    mode = true;
    refs.libraryResults.innerHTML = '';
    renderBack();
    const msg = document.createElement('p');
    msg.className = 'ai-library-message';
    msg.textContent = 'Please generate to see AI memes';
    refs.libraryResults.appendChild(msg);
  }

  function showLoading() {
    if (!isDesktop()) return;
    mode = true;
    refs.libraryResults.innerHTML = '';
    renderBack();
    const msg = document.createElement('p');
    msg.className = 'ai-library-message';
    msg.textContent = 'Generating AI meme suggestions...';
    refs.libraryResults.appendChild(msg);
  }

  function renderSuggestions(list) {
    if (!isDesktop()) return;
    mode = true;
    suggestions = Array.isArray(list) ? list : [];
    refs.libraryResults.innerHTML = '';
    renderBack();
    suggestions.forEach(s => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'meme-search-card ai-suggestion-card';
      card.setAttribute('data-template-id', s.id);
      const img = document.createElement('img');
      img.src = s.url; img.alt = s.name;
      const label = document.createElement('span');
      label.className = 'meme-search-name';
      label.textContent = s.name;
      card.appendChild(img); card.appendChild(label);
      refs.libraryResults.appendChild(card);
    });
  }

  function exitMode() {
    mode = false;
    suggestions = [];
    refs.libraryResults.innerHTML = '';
  }

  return {
    showEmpty,
    showLoading,
    renderSuggestions,
    exitMode,
    isMode: () => mode,
    getSuggestions: () => suggestions
  };
}

beforeEach(() => {
  jest.resetModules();
  delete window.MemeGen.AISuggestions;
  delete window.MemeGen.GeminiClient;
  require('../meme-app/js/GeminiClient.js');
  require('../meme-app/js/AISuggestions.js');
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  document.body.innerHTML = '';
  jest.restoreAllMocks();
});

// ── New AISuggestions callbacks ─────────────────────────────────────────────

describe('AISuggestions — new optional callbacks', () => {
  beforeEach(() => {
    MemeGen.GeminiClient.setApiKey('AIzaTEST');
  });

  it('fires onGenerateStart synchronously when Generate is clicked', () => {
    const refs = mountAiDom();
    const onStart = jest.fn();
    jest.spyOn(MemeGen.GeminiClient, 'generateSuggestions').mockResolvedValue([
      { template_id: '181913649', captions: ['a', 'b'] }
    ]);
    MemeGen.AISuggestions.init({
      ...refs,
      onSelect: jest.fn(),
      onGenerateStart: onStart
    });
    MemeGen.AISuggestions._setMemesForTest(SAMPLE_MEMES);

    refs.getBtn.click();
    refs.identity.value = 'a student';
    refs.situation.value = 'finals';
    refs.generateBtn.click();

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('fires onGenerated with normalized {id,name,url,captions}[] after a successful response', async () => {
    const refs = mountAiDom();
    const onGenerated = jest.fn();
    jest.spyOn(MemeGen.GeminiClient, 'generateSuggestions').mockResolvedValue([
      { template_id: '181913649', captions: ['Studying', 'Doomscrolling'] },
      { template_id: '87743020',  captions: ['Top', 'Bottom'] }
    ]);
    MemeGen.AISuggestions.init({
      ...refs,
      onSelect: jest.fn(),
      onGenerated
    });
    MemeGen.AISuggestions._setMemesForTest(SAMPLE_MEMES);

    refs.getBtn.click();
    refs.identity.value = 'a student';
    refs.situation.value = 'finals';
    refs.generateBtn.click();
    await flushPromises();
    await flushPromises();

    expect(onGenerated).toHaveBeenCalledTimes(1);
    const arg = onGenerated.mock.calls[0][0];
    expect(Array.isArray(arg)).toBe(true);
    expect(arg.length).toBe(2);
    expect(arg[0]).toMatchObject({
      id: '181913649',
      name: 'Drake Hotline Bling',
      url: 'https://i.imgflip.com/30b1gx.jpg'
    });
    expect(arg[0].captions).toEqual(['Studying', 'Doomscrolling']);
  });

  it('still renders the in-panel #ai-results cards even when onGenerated is provided', async () => {
    const refs = mountAiDom();
    const onGenerated = jest.fn();
    jest.spyOn(MemeGen.GeminiClient, 'generateSuggestions').mockResolvedValue([
      { template_id: '181913649', captions: ['x', 'y'] }
    ]);
    MemeGen.AISuggestions.init({
      ...refs,
      onSelect: jest.fn(),
      onGenerated
    });
    MemeGen.AISuggestions._setMemesForTest(SAMPLE_MEMES);

    refs.getBtn.click();
    refs.identity.value = 'a';
    refs.situation.value = 'b';
    refs.generateBtn.click();
    await flushPromises();
    await flushPromises();

    // Both surfaces hear from the same generate.
    expect(refs.results.querySelectorAll('.ai-result-card').length).toBe(1);
    expect(onGenerated).toHaveBeenCalled();
  });

  it('fires onGenerateError when Gemini returns a recognizable error class', async () => {
    const refs = mountAiDom();
    const onError = jest.fn();
    const apiErr = new MemeGen.GeminiClient.NetworkError('offline');
    jest.spyOn(MemeGen.GeminiClient, 'generateSuggestions').mockRejectedValue(apiErr);
    MemeGen.AISuggestions.init({
      ...refs,
      onSelect: jest.fn(),
      onGenerateError: onError
    });
    MemeGen.AISuggestions._setMemesForTest(SAMPLE_MEMES);

    refs.getBtn.click();
    refs.identity.value = 'a';
    refs.situation.value = 'b';
    refs.generateBtn.click();
    await flushPromises();
    await flushPromises();

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire onGenerateError for the no-key path (recoverable — host should not show error state)', async () => {
    const refs = mountAiDom();
    const onError = jest.fn();
    // Wipe the key — controller's no-key branch must short-circuit before
    // any network call happens, so no error path runs.
    window.localStorage.clear();
    MemeGen.AISuggestions.init({
      ...refs,
      onSelect: jest.fn(),
      onGenerateError: onError
    });
    MemeGen.AISuggestions._setMemesForTest(SAMPLE_MEMES);

    refs.getBtn.click();
    refs.identity.value = 'a';
    refs.situation.value = 'b';
    refs.generateBtn.click();
    await flushPromises();

    expect(onError).not.toHaveBeenCalled();
    expect(refs.keyForm.hidden).toBe(false);
  });

  it('omitting all new callbacks is safe — old callers stay unchanged', async () => {
    const refs = mountAiDom();
    const onSelect = jest.fn();
    jest.spyOn(MemeGen.GeminiClient, 'generateSuggestions').mockResolvedValue([
      { template_id: '181913649', captions: ['a', 'b'] }
    ]);
    MemeGen.GeminiClient.setApiKey('AIzaTEST');
    // No onGenerateStart / onGenerated / onGenerateError supplied.
    expect(() => {
      MemeGen.AISuggestions.init({ ...refs, onSelect });
    }).not.toThrow();
    MemeGen.AISuggestions._setMemesForTest(SAMPLE_MEMES);

    refs.getBtn.click();
    refs.identity.value = 'a';
    refs.situation.value = 'b';
    refs.generateBtn.click();
    await flushPromises();
    await flushPromises();

    expect(refs.results.querySelectorAll('.ai-result-card').length).toBe(1);
  });
});

// ── Desktop library state machine ───────────────────────────────────────────

describe('Desktop AI library mode helpers', () => {
  it('showEmpty renders "Please generate to see AI memes" plus a back button on desktop', () => {
    const refs = mountAiDom();
    const lib = makeDesktopAiLibrary(refs, () => true);
    lib.showEmpty();
    expect(lib.isMode()).toBe(true);
    expect(refs.libraryResults.querySelector('.ai-library-message').textContent)
      .toBe('Please generate to see AI memes');
    expect(refs.libraryResults.querySelector('.ai-library-back')).not.toBeNull();
  });

  it('showLoading renders "Generating AI meme suggestions..." on desktop', () => {
    const refs = mountAiDom();
    const lib = makeDesktopAiLibrary(refs, () => true);
    lib.showLoading();
    expect(refs.libraryResults.querySelector('.ai-library-message').textContent)
      .toBe('Generating AI meme suggestions...');
  });

  it('renderSuggestions paints one card per item and clears the loading message', () => {
    const refs = mountAiDom();
    const lib = makeDesktopAiLibrary(refs, () => true);
    lib.showLoading();
    lib.renderSuggestions([
      { id: '1', name: 'A', url: 'a.png', captions: ['x', 'y'] },
      { id: '2', name: 'B', url: 'b.png', captions: ['p', 'q'] }
    ]);
    const cards = refs.libraryResults.querySelectorAll('.ai-suggestion-card');
    expect(cards.length).toBe(2);
    // The transient loading message must be gone.
    expect(refs.libraryResults.querySelector('.ai-library-message')).toBeNull();
    expect(cards[0].getAttribute('data-template-id')).toBe('1');
  });

  it('exitMode clears the library back to empty (host then re-renders templates)', () => {
    const refs = mountAiDom();
    const lib = makeDesktopAiLibrary(refs, () => true);
    lib.renderSuggestions([{ id: '1', name: 'A', url: 'a.png', captions: [] }]);
    expect(refs.libraryResults.children.length).toBeGreaterThan(0);
    lib.exitMode();
    expect(lib.isMode()).toBe(false);
    expect(refs.libraryResults.children.length).toBe(0);
  });

  it('clicking the back button calls exitMode and clears the library', () => {
    const refs = mountAiDom();
    const lib = makeDesktopAiLibrary(refs, () => true);
    lib.showEmpty();
    const back = refs.libraryResults.querySelector('.ai-library-back');
    expect(back).not.toBeNull();
    back.click();
    expect(lib.isMode()).toBe(false);
    expect(refs.libraryResults.children.length).toBe(0);
  });

  it('all helpers are no-ops on mobile (isDesktop returns false)', () => {
    const refs = mountAiDom();
    const lib = makeDesktopAiLibrary(refs, () => false);
    // Pre-fill the library to prove nothing gets cleared either.
    refs.libraryResults.innerHTML = '<button class="meme-search-card">existing</button>';
    lib.showEmpty();
    lib.showLoading();
    lib.renderSuggestions([{ id: '1', name: 'A', url: 'a.png', captions: [] }]);
    expect(lib.isMode()).toBe(false);
    expect(refs.libraryResults.children.length).toBe(1);
    expect(refs.libraryResults.querySelector('.meme-search-card').textContent).toBe('existing');
  });
});

// ── End-to-end glue: AISuggestions callbacks drive the desktop library ─────

describe('AISuggestions ⇄ desktop library integration', () => {
  beforeEach(() => {
    MemeGen.GeminiClient.setApiKey('AIzaTEST');
  });

  it('Generate flips library to loading, then to cards, on desktop', async () => {
    const refs = mountAiDom();
    const lib = makeDesktopAiLibrary(refs, () => true);
    jest.spyOn(MemeGen.GeminiClient, 'generateSuggestions').mockResolvedValue([
      { template_id: '181913649', captions: ['a', 'b'] },
      { template_id: '87743020',  captions: ['c', 'd'] }
    ]);
    MemeGen.AISuggestions.init({
      ...refs,
      onSelect: jest.fn(),
      onGenerateStart: lib.showLoading,
      onGenerated: lib.renderSuggestions,
      onGenerateError: jest.fn()
    });
    MemeGen.AISuggestions._setMemesForTest(SAMPLE_MEMES);

    // Start in the empty state, as the desktop AI button click would.
    lib.showEmpty();
    expect(refs.libraryResults.querySelector('.ai-library-message').textContent)
      .toMatch(/please generate/i);

    refs.getBtn.click();
    refs.identity.value = 'a';
    refs.situation.value = 'b';
    refs.generateBtn.click();

    // After click but BEFORE the resolved promise: loading message.
    expect(refs.libraryResults.querySelector('.ai-library-message').textContent)
      .toMatch(/generating/i);

    await flushPromises();
    await flushPromises();

    // After resolve: cards replace the loading message.
    const cards = refs.libraryResults.querySelectorAll('.ai-suggestion-card');
    expect(cards.length).toBe(2);
    expect(refs.libraryResults.querySelector('.ai-library-message')).toBeNull();
  });

  it('Generate is a no-op for the library on mobile, but the panel still gets cards', async () => {
    const refs = mountAiDom();
    const lib = makeDesktopAiLibrary(refs, () => false); // mobile gate
    jest.spyOn(MemeGen.GeminiClient, 'generateSuggestions').mockResolvedValue([
      { template_id: '181913649', captions: ['a', 'b'] }
    ]);
    MemeGen.AISuggestions.init({
      ...refs,
      onSelect: jest.fn(),
      onGenerateStart: lib.showLoading,
      onGenerated: lib.renderSuggestions
    });
    MemeGen.AISuggestions._setMemesForTest(SAMPLE_MEMES);

    refs.getBtn.click();
    refs.identity.value = 'a';
    refs.situation.value = 'b';
    refs.generateBtn.click();
    await flushPromises();
    await flushPromises();

    // Mobile path: library untouched.
    expect(refs.libraryResults.children.length).toBe(0);
    expect(lib.isMode()).toBe(false);
    // Panel still renders cards (existing AI panel behavior).
    expect(refs.results.querySelectorAll('.ai-result-card').length).toBe(1);
  });
});

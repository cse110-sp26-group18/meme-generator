/**
 * ai_suggestions.test.js
 * Verifies the AISuggestions controller module.
 *
 * Spies on MemeGen.GeminiClient.generateSuggestions rather than hitting fetch,
 * so this file isolates the controller's DOM + flow logic from the API client.
 *
 * Covers:
 *  - Clicking "Get AI Suggestions" reveals the form
 *  - Empty identity/situation shows a validation message
 *  - Submitting without a key shows the key form
 *  - Saving a key persists it and replays the pending Generate
 *  - Happy path renders 3 cards with name + captions
 *  - Clicking a card invokes onSelect(template, captions)
 *  - Error mapping: each GeminiClient error class -> the right status message
 *
 * Module under test: meme-app/js/AISuggestions.js
 */

function mountAiSuggestionsDom() {
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
    results: document.getElementById('ai-results')
  };
}

function flushPromises() {
  return new Promise(function (resolve) { setTimeout(resolve, 0); });
}

/** Sample ImgFlip-shaped memes used by the controller after the refactor. */
const SAMPLE_MEMES = [
  { id: '181913649', name: 'Drake Hotline Bling',  url: 'https://i.imgflip.com/30b1gx.jpg' },
  { id: '112126428', name: 'Distracted Boyfriend', url: 'https://i.imgflip.com/1ur9b0.jpg' },
  { id: '87743020',  name: 'Two Buttons',          url: 'https://i.imgflip.com/1g8my4.jpg' }
];

function initWithDom(onSelect) {
  const refs = mountAiSuggestionsDom();
  MemeGen.AISuggestions.init({ ...refs, onSelect: onSelect || null });
  // Skip the real ImgFlip fetch in tests — feed the controller a fixed pool.
  MemeGen.AISuggestions._setMemesForTest(SAMPLE_MEMES);
  return refs;
}

// ── Per-test fresh module + clean localStorage ────────────────────────────────

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

// ── Reveal flow ──────────────────────────────────────────────────────────────

describe('AISuggestions — reveal flow', () => {
  it('hides the form by default', () => {
    const refs = initWithDom();
    expect(refs.form.hidden).toBe(true);
  });

  it('clicking Get AI Suggestions reveals the form and hides the Get button', () => {
    const refs = initWithDom();
    refs.getBtn.click();
    expect(refs.form.hidden).toBe(false);
    expect(refs.getBtn.hidden).toBe(true);
  });
});

// ── Validation ───────────────────────────────────────────────────────────────

describe('AISuggestions — validation', () => {
  it('shows a validation message and does not call Gemini when identity is empty', () => {
    const refs = initWithDom();
    const spy = jest.spyOn(MemeGen.GeminiClient, 'generateSuggestions');
    refs.getBtn.click();
    refs.identity.value = '';
    refs.situation.value = 'finals';
    refs.generateBtn.click();
    expect(refs.status.textContent.toLowerCase()).toMatch(/please fill/);
    expect(spy).not.toHaveBeenCalled();
  });

  it('shows a validation message when situation is empty', () => {
    const refs = initWithDom();
    const spy = jest.spyOn(MemeGen.GeminiClient, 'generateSuggestions');
    refs.getBtn.click();
    refs.identity.value = 'a student';
    refs.situation.value = '';
    refs.generateBtn.click();
    expect(refs.status.textContent.toLowerCase()).toMatch(/please fill/);
    expect(spy).not.toHaveBeenCalled();
  });
});

// ── Missing-key flow ─────────────────────────────────────────────────────────

describe('AISuggestions — missing-key flow', () => {
  it('shows the key form and does not call Gemini when no key is set', () => {
    const refs = initWithDom();
    const spy = jest.spyOn(MemeGen.GeminiClient, 'generateSuggestions');
    refs.getBtn.click();
    refs.identity.value = 'a student';
    refs.situation.value = 'finals';
    refs.generateBtn.click();
    expect(refs.keyForm.hidden).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    expect(refs.status.textContent.toLowerCase()).toMatch(/api key/);
  });

  it('saving a key persists it, hides the key form, and replays the pending Generate', async () => {
    const refs = initWithDom();
    const spy = jest.spyOn(MemeGen.GeminiClient, 'generateSuggestions')
      .mockResolvedValue([
        { template_id: '181913649', captions: ['top', 'bottom'] }
      ]);
    refs.getBtn.click();
    refs.identity.value = 'a student';
    refs.situation.value = 'finals';
    refs.generateBtn.click();
    // Key form should be showing now
    expect(refs.keyForm.hidden).toBe(false);
    expect(spy).not.toHaveBeenCalled();

    refs.keyInput.value = 'AIzaTESTKEY';
    refs.keySaveBtn.click();

    expect(MemeGen.GeminiClient.getApiKey()).toBe('AIzaTESTKEY');
    expect(refs.keyForm.hidden).toBe(true);
    expect(refs.changeKeyLink.hidden).toBe(false);

    // fetchMemes runs before the Gemini call now, so we need to flush the
    // memes promise before generateSuggestions is invoked.
    await flushPromises();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('a student', 'finals', expect.any(Array));

    await flushPromises();
    expect(refs.results.querySelectorAll('.ai-result-card').length).toBe(1);
  });

  it('Save with an empty key shows a message and does not persist', () => {
    const refs = initWithDom();
    refs.getBtn.click();
    refs.identity.value = 'a student';
    refs.situation.value = 'finals';
    refs.generateBtn.click();
    refs.keyInput.value = '   ';
    refs.keySaveBtn.click();
    expect(MemeGen.GeminiClient.getApiKey()).toBeNull();
    expect(refs.keyForm.hidden).toBe(false);
    expect(refs.status.textContent.toLowerCase()).toMatch(/paste a key/);
  });
});

// ── Happy path ───────────────────────────────────────────────────────────────

describe('AISuggestions — happy path', () => {
  beforeEach(() => {
    MemeGen.GeminiClient.setApiKey('AIzaXX');
  });

  it('renders one card per returned suggestion with name + captions', async () => {
    const refs = initWithDom();
    const suggestions = [
      { template_id: '181913649', captions: ['Studying',          'Doomscrolling'] },
      { template_id: '112126428', captions: ['Me, my GPA',        'A new TikTok'] },
      { template_id: '87743020',  captions: ['Study for finals',  'Watch one more'] }
    ];
    jest.spyOn(MemeGen.GeminiClient, 'generateSuggestions').mockResolvedValue(suggestions);

    refs.getBtn.click();
    refs.identity.value = 'a college student';
    refs.situation.value = 'struggling for finals';
    refs.generateBtn.click();
    await flushPromises();

    const cards = refs.results.querySelectorAll('.ai-result-card');
    expect(cards.length).toBe(3);
    expect(cards[0].querySelector('.ai-result-name').textContent).toBe('Drake Hotline Bling');
    const captionItems = cards[0].querySelectorAll('.ai-caption-list li');
    expect(captionItems.length).toBe(2);
    expect(captionItems[0].textContent).toBe('Studying');
    expect(captionItems[1].textContent).toBe('Doomscrolling');
  });

  it('clicking a card invokes onSelect(template, captions)', async () => {
    const onSelect = jest.fn();
    const refs = initWithDom(onSelect);
    jest.spyOn(MemeGen.GeminiClient, 'generateSuggestions').mockResolvedValue([
      { template_id: '87743020', captions: ['cap a', 'cap b'] }
    ]);

    refs.getBtn.click();
    refs.identity.value = 'x';
    refs.situation.value = 'y';
    refs.generateBtn.click();
    await flushPromises();

    const card = refs.results.querySelector('.ai-result-card');
    card.click();

    expect(onSelect).toHaveBeenCalledTimes(1);
    const [template, captions] = onSelect.mock.calls[0];
    expect(template.id).toBe('87743020');
    expect(template.name).toBe('Two Buttons');
    expect(template.url).toBe('https://i.imgflip.com/1g8my4.jpg');
    expect(captions).toEqual(['cap a', 'cap b']);
  });

  it('drops cards whose template_id is not in the fetched ImgFlip pool', async () => {
    const refs = initWithDom();
    jest.spyOn(MemeGen.GeminiClient, 'generateSuggestions').mockResolvedValue([
      { template_id: '181913649', captions: ['a', 'b'] },
      { template_id: 'made-up-xyz', captions: ['c', 'd'] }
    ]);

    refs.getBtn.click();
    refs.identity.value = 'x';
    refs.situation.value = 'y';
    refs.generateBtn.click();
    await flushPromises();

    const cards = refs.results.querySelectorAll('.ai-result-card');
    expect(cards.length).toBe(1);
    expect(cards[0].getAttribute('data-template-id')).toBe('181913649');
  });
});

// ── Error mapping ────────────────────────────────────────────────────────────

describe('AISuggestions — error mapping', () => {
  beforeEach(() => {
    MemeGen.GeminiClient.setApiKey('AIzaXX');
  });

  async function runWithError(err) {
    const refs = initWithDom();
    jest.spyOn(MemeGen.GeminiClient, 'generateSuggestions').mockRejectedValue(err);
    refs.getBtn.click();
    refs.identity.value = 'x';
    refs.situation.value = 'y';
    refs.generateBtn.click();
    await flushPromises();
    return refs;
  }

  it('APIError 429 -> rate limited message', async () => {
    const refs = await runWithError(new MemeGen.GeminiClient.APIError('rate', 429));
    expect(refs.status.textContent.toLowerCase()).toMatch(/rate limited/);
  });

  it('APIError 400 -> invalid-key message', async () => {
    const refs = await runWithError(new MemeGen.GeminiClient.APIError('bad request', 400));
    expect(refs.status.textContent.toLowerCase()).toMatch(/api key may be invalid|http 400/);
  });

  it('NetworkError -> could-not-reach message', async () => {
    const refs = await runWithError(new MemeGen.GeminiClient.NetworkError('offline'));
    expect(refs.status.textContent.toLowerCase()).toMatch(/could not reach gemini/);
  });

  it('ParseError -> unexpected-response message', async () => {
    const refs = await runWithError(new MemeGen.GeminiClient.ParseError('mangled'));
    expect(refs.status.textContent.toLowerCase()).toMatch(/unexpected response/);
  });

  it('KeyError -> re-shows the key form', async () => {
    const refs = await runWithError(new MemeGen.GeminiClient.KeyError());
    expect(refs.keyForm.hidden).toBe(false);
    expect(refs.status.textContent.toLowerCase()).toMatch(/api key/);
  });
});

// ── Change-key link ──────────────────────────────────────────────────────────

describe('AISuggestions — Change API key link', () => {
  it('is hidden when no key is saved, visible when a key is saved', () => {
    let refs = initWithDom();
    expect(refs.changeKeyLink.hidden).toBe(true);
    document.body.innerHTML = '';

    MemeGen.GeminiClient.setApiKey('AIzaXX');
    refs = initWithDom();
    expect(refs.changeKeyLink.hidden).toBe(false);
  });

  it('clicking it prefills the existing key and shows the key form', () => {
    MemeGen.GeminiClient.setApiKey('AIzaABC');
    const refs = initWithDom();
    refs.changeKeyLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(refs.keyForm.hidden).toBe(false);
    expect(refs.keyInput.value).toBe('AIzaABC');
  });
});

// ── TextBoxManager.createBatch (smoke test for the new method) ───────────────

describe('TextBoxManager.createBatch', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="container" style="position: relative; width: 600px; height: 400px;">
        <canvas id="meme-canvas" width="600" height="400"></canvas>
      </div>
    `;
    // jsdom returns 0 for offsetWidth/Height by default; pin them so the
    // clamping math in createBatch works.
    const container = document.getElementById('container');
    Object.defineProperty(container, 'offsetWidth',  { value: 600, configurable: true });
    Object.defineProperty(container, 'offsetHeight', { value: 400, configurable: true });

    // No reset() on this branch's TextBoxManager — clean up via destroy().
    MemeGen.TextBoxManager.getAll().slice().forEach(function (tb) { tb.destroy(); });
    MemeGen.TextBoxManager.init(container, document.getElementById('meme-canvas'));
  });

  it('creates one DOM text box per item with the supplied text', () => {
    MemeGen.TextBoxManager.createBatch([
      { x: 100, y: 20,  text: 'TOP' },
      { x: 100, y: 320, text: 'BOTTOM' }
    ]);
    const boxes = MemeGen.TextBoxManager.getAll();
    expect(boxes.length).toBe(2);
    expect(boxes[0].textarea.value).toBe('TOP');
    expect(boxes[1].textarea.value).toBe('BOTTOM');
  });

  it('leaves every created box deselected', () => {
    MemeGen.TextBoxManager.createBatch([
      { x: 50, y: 50, text: 'A' },
      { x: 50, y: 200, text: 'B' }
    ]);
    const boxes = MemeGen.TextBoxManager.getAll();
    boxes.forEach(function (b) { expect(b.selected).toBe(false); });
  });

  it('returns the array of created TextBox instances', () => {
    const out = MemeGen.TextBoxManager.createBatch([
      { x: 10, y: 10, text: 'one' }
    ]);
    expect(Array.isArray(out)).toBe(true);
    expect(out.length).toBe(1);
    expect(out[0].textarea.value).toBe('one');
  });

  it('returns [] when given a non-array input', () => {
    expect(MemeGen.TextBoxManager.createBatch(null)).toEqual([]);
    expect(MemeGen.TextBoxManager.createBatch(undefined)).toEqual([]);
  });
});

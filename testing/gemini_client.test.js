/**
 * gemini_client.test.js
 * Verifies the GeminiClient wrapper around the Google Gemini API.
 *
 * Covers:
 *  - localStorage key round-trips (get/set/clear/hasApiKey)
 *  - setApiKey trims whitespace
 *  - buildRequestBody includes every template id, the system instruction,
 *    and the responseSchema
 *  - generateSuggestions happy path: URL has model + key, request method/body
 *    are correct, returns parsed suggestions
 *  - Code-fence stripping: Gemini wraps JSON in ```json ... ``` and we still
 *    parse it
 *  - Invalid template_id filtering: unknown ids are dropped, known ones
 *    survive
 *  - Zero valid suggestions -> ParseError
 *  - Malformed JSON -> ParseError
 *  - Missing API key -> KeyError (rejected promise)
 *  - HTTP 429 -> APIError with status=429
 *  - HTTP 4xx (other) -> APIError with the status surfaced
 *  - Network reject -> NetworkError
 *
 * jsdom notes:
 *  - jsdom does not implement window.fetch; we stub global.fetch per test.
 *  - The GeminiClient IIFE has no per-call state, but we still
 *    jest.resetModules() per test for hygiene and re-require so any
 *    closed-over constants are fresh.
 *
 * Module under test: meme-app/js/GeminiClient.js
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Stub fetch that resolves to a structured Gemini envelope. */
function mockFetchGeminiJson(suggestions, { ok = true, status = 200 } = {}) {
  var body = { suggestions: suggestions };
  var envelope = {
    candidates: [{
      content: {
        parts: [{ text: JSON.stringify(body) }]
      }
    }]
  };
  return jest.fn().mockResolvedValue({
    ok: ok,
    status: status,
    json: () => Promise.resolve(envelope),
    text: () => Promise.resolve(JSON.stringify(envelope))
  });
}

/** Stub fetch that returns a raw text body (for fence-stripping / malformed). */
function mockFetchGeminiRawText(rawText, { ok = true, status = 200 } = {}) {
  var envelope = {
    candidates: [{
      content: {
        parts: [{ text: rawText }]
      }
    }]
  };
  return jest.fn().mockResolvedValue({
    ok: ok,
    status: status,
    json: () => Promise.resolve(envelope),
    text: () => Promise.resolve(JSON.stringify(envelope))
  });
}

/** Stub fetch that resolves to an HTTP-error response. */
function mockFetchHttpError(status, message) {
  return jest.fn().mockResolvedValue({
    ok: false,
    status: status,
    json: () => Promise.resolve({ error: { message: message } }),
    text: () => Promise.resolve(message || ('HTTP ' + status))
  });
}

/** Stub fetch that rejects (genuine network failure). */
function mockFetchReject(err) {
  return jest.fn().mockRejectedValue(err || new Error('network down'));
}

function flushPromises() {
  return new Promise(function (resolve) { setTimeout(resolve, 0); });
}

const SAMPLE_TEMPLATES = [
  { id: 'lebron-sad',         character: 'LeBron',    emotion: 'sad',     tags: ['sports', 'sad'] },
  { id: 'spongebob-dead',     character: 'SpongeBob', emotion: 'dead',    tags: ['cartoon', 'tired'] },
  { id: 'taj-sorry',          character: 'TAJ',       emotion: 'sorry',   tags: ['regret'] }
];

// ── Per-test fresh module + clean localStorage ────────────────────────────────

let savedFetch;

beforeEach(() => {
  jest.resetModules();
  delete window.MemeGen.GeminiClient;
  require('../meme-app/js/GeminiClient.js');
  savedFetch = global.fetch;
  window.localStorage.clear();
});

afterEach(() => {
  global.fetch = savedFetch;
  window.localStorage.clear();
  jest.restoreAllMocks();
});

// ── API key storage ──────────────────────────────────────────────────────────

describe('GeminiClient — API key storage', () => {
  it('returns null before any key is set', () => {
    expect(MemeGen.GeminiClient.getApiKey()).toBeNull();
    expect(MemeGen.GeminiClient.hasApiKey()).toBe(false);
  });

  it('persists a key via setApiKey/getApiKey round-trip', () => {
    MemeGen.GeminiClient.setApiKey('AIzaTESTKEY123');
    expect(MemeGen.GeminiClient.getApiKey()).toBe('AIzaTESTKEY123');
    expect(MemeGen.GeminiClient.hasApiKey()).toBe(true);
  });

  it('trims whitespace when saving', () => {
    MemeGen.GeminiClient.setApiKey('  AIza-PADDED  \n');
    expect(MemeGen.GeminiClient.getApiKey()).toBe('AIza-PADDED');
  });

  it('does not save when given an empty/whitespace string', () => {
    MemeGen.GeminiClient.setApiKey('   ');
    expect(MemeGen.GeminiClient.getApiKey()).toBeNull();
    MemeGen.GeminiClient.setApiKey('');
    expect(MemeGen.GeminiClient.getApiKey()).toBeNull();
  });

  it('clearApiKey removes the stored key', () => {
    MemeGen.GeminiClient.setApiKey('AIzaXYZ');
    MemeGen.GeminiClient.clearApiKey();
    expect(MemeGen.GeminiClient.getApiKey()).toBeNull();
    expect(MemeGen.GeminiClient.hasApiKey()).toBe(false);
  });

  it('hasApiKey treats a whitespace-only stored value as absent', () => {
    // Bypass setApiKey to write a whitespace value directly.
    window.localStorage.setItem('mg.geminiApiKey', '   ');
    expect(MemeGen.GeminiClient.hasApiKey()).toBe(false);
  });
});

// ── buildRequestBody ─────────────────────────────────────────────────────────

describe('GeminiClient — buildRequestBody', () => {
  it('includes the system instruction', () => {
    const body = MemeGen.GeminiClient.buildRequestBody('a student', 'finals', SAMPLE_TEMPLATES);
    expect(body.systemInstruction.parts[0].text).toBe(MemeGen.GeminiClient._SYSTEM_INSTRUCTION);
  });

  it('embeds every template id in the user prompt', () => {
    const body = MemeGen.GeminiClient.buildRequestBody('a student', 'finals', SAMPLE_TEMPLATES);
    const prompt = body.contents[0].parts[0].text;
    SAMPLE_TEMPLATES.forEach(function (t) {
      expect(prompt).toContain(t.id);
    });
  });

  it('embeds identity and situation strings in the user prompt', () => {
    const body = MemeGen.GeminiClient.buildRequestBody('a college student', 'struggling for finals', SAMPLE_TEMPLATES);
    const prompt = body.contents[0].parts[0].text;
    expect(prompt).toContain('a college student');
    expect(prompt).toContain('struggling for finals');
  });

  it('sets responseMimeType to application/json with the documented schema', () => {
    const body = MemeGen.GeminiClient.buildRequestBody('x', 'y', SAMPLE_TEMPLATES);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema).toEqual(MemeGen.GeminiClient._RESPONSE_SCHEMA);
  });
});

// ── generateSuggestions — happy path ─────────────────────────────────────────

describe('GeminiClient.generateSuggestions — happy path', () => {
  beforeEach(() => {
    MemeGen.GeminiClient.setApiKey('AIzaTESTKEY');
  });

  it('resolves to up to 3 valid suggestions', async () => {
    const fetchMock = mockFetchGeminiJson([
      { template_id: 'lebron-sad',     captions: ['When you fail', 'The whole semester'] },
      { template_id: 'spongebob-dead', captions: ['Me at 3am', 'Studying for finals'] },
      { template_id: 'taj-sorry',      captions: ['Sorry brain', 'No more space'] }
    ]);
    global.fetch = fetchMock;

    const result = await MemeGen.GeminiClient.generateSuggestions('a student', 'finals', SAMPLE_TEMPLATES);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      template_id: 'lebron-sad',
      captions: ['When you fail', 'The whole semester']
    });
  });

  it('calls the correct URL with the key as a query param', async () => {
    const fetchMock = mockFetchGeminiJson([
      { template_id: 'lebron-sad', captions: ['a', 'b'] }
    ]);
    global.fetch = fetchMock;

    await MemeGen.GeminiClient.generateSuggestions('x', 'y', SAMPLE_TEMPLATES);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0];
    expect(url).toMatch(/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash:generateContent\?key=/);
    expect(url).toContain('key=AIzaTESTKEY');
  });

  it('sends a POST with JSON content-type and JSON body', async () => {
    const fetchMock = mockFetchGeminiJson([
      { template_id: 'lebron-sad', captions: ['a', 'b'] }
    ]);
    global.fetch = fetchMock;

    await MemeGen.GeminiClient.generateSuggestions('a student', 'finals week', SAMPLE_TEMPLATES);

    const opts = fetchMock.mock.calls[0][1];
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe('application/json');
    const sentBody = JSON.parse(opts.body);
    expect(sentBody.contents[0].parts[0].text).toContain('a student');
    expect(sentBody.contents[0].parts[0].text).toContain('finals week');
    expect(sentBody.generationConfig.responseSchema).toEqual(MemeGen.GeminiClient._RESPONSE_SCHEMA);
  });
});

// ── generateSuggestions — fence stripping ────────────────────────────────────

describe('GeminiClient.generateSuggestions — code-fence stripping', () => {
  beforeEach(() => MemeGen.GeminiClient.setApiKey('AIzaXX'));

  it('parses JSON wrapped in a ```json fence', async () => {
    const fenced = '```json\n' + JSON.stringify({
      suggestions: [{ template_id: 'taj-sorry', captions: ['a', 'b'] }]
    }) + '\n```';
    global.fetch = mockFetchGeminiRawText(fenced);

    const result = await MemeGen.GeminiClient.generateSuggestions('i', 's', SAMPLE_TEMPLATES);
    expect(result).toHaveLength(1);
    expect(result[0].template_id).toBe('taj-sorry');
  });

  it('parses JSON wrapped in a plain ``` fence', async () => {
    const fenced = '```\n' + JSON.stringify({
      suggestions: [{ template_id: 'taj-sorry', captions: ['a', 'b'] }]
    }) + '\n```';
    global.fetch = mockFetchGeminiRawText(fenced);

    const result = await MemeGen.GeminiClient.generateSuggestions('i', 's', SAMPLE_TEMPLATES);
    expect(result[0].template_id).toBe('taj-sorry');
  });
});

// ── generateSuggestions — id filtering ───────────────────────────────────────

describe('GeminiClient.generateSuggestions — invalid id filtering', () => {
  beforeEach(() => MemeGen.GeminiClient.setApiKey('AIzaXX'));

  it('drops suggestions whose template_id is not in the supplied list', async () => {
    global.fetch = mockFetchGeminiJson([
      { template_id: 'lebron-sad',          captions: ['ok', 'good'] },
      { template_id: 'made-up-id-xyz',      captions: ['bad',  'wrong'] },
      { template_id: 'spongebob-dead',      captions: ['fine', 'great'] }
    ]);

    const result = await MemeGen.GeminiClient.generateSuggestions('i', 's', SAMPLE_TEMPLATES);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.template_id)).toEqual(['lebron-sad', 'spongebob-dead']);
  });

  it('rejects with ParseError when every returned id is unknown', async () => {
    global.fetch = mockFetchGeminiJson([
      { template_id: 'nope-1', captions: ['a', 'b'] },
      { template_id: 'nope-2', captions: ['c', 'd'] }
    ]);

    await expect(
      MemeGen.GeminiClient.generateSuggestions('i', 's', SAMPLE_TEMPLATES)
    ).rejects.toBeInstanceOf(MemeGen.GeminiClient.ParseError);
  });

  it('caps at 3 even if Gemini returns more', async () => {
    global.fetch = mockFetchGeminiJson([
      { template_id: 'lebron-sad',     captions: ['a', 'b'] },
      { template_id: 'spongebob-dead', captions: ['c', 'd'] },
      { template_id: 'taj-sorry',      captions: ['e', 'f'] },
      { template_id: 'lebron-sad',     captions: ['g', 'h'] }
    ]);

    const result = await MemeGen.GeminiClient.generateSuggestions('i', 's', SAMPLE_TEMPLATES);
    expect(result).toHaveLength(3);
  });
});

// ── generateSuggestions — malformed JSON ─────────────────────────────────────

describe('GeminiClient.generateSuggestions — malformed JSON', () => {
  beforeEach(() => MemeGen.GeminiClient.setApiKey('AIzaXX'));

  it('rejects with ParseError when the part text is not JSON', async () => {
    global.fetch = mockFetchGeminiRawText('this is not JSON');
    await expect(
      MemeGen.GeminiClient.generateSuggestions('i', 's', SAMPLE_TEMPLATES)
    ).rejects.toBeInstanceOf(MemeGen.GeminiClient.ParseError);
  });

  it('rejects with ParseError when the envelope has no candidates', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('{}')
    });
    await expect(
      MemeGen.GeminiClient.generateSuggestions('i', 's', SAMPLE_TEMPLATES)
    ).rejects.toBeInstanceOf(MemeGen.GeminiClient.ParseError);
  });
});

// ── generateSuggestions — auth and HTTP errors ───────────────────────────────

describe('GeminiClient.generateSuggestions — error paths', () => {
  it('rejects with KeyError synchronously (via rejected promise) when no key is set', async () => {
    global.fetch = jest.fn();
    await expect(
      MemeGen.GeminiClient.generateSuggestions('i', 's', SAMPLE_TEMPLATES)
    ).rejects.toBeInstanceOf(MemeGen.GeminiClient.KeyError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects with APIError carrying status=429 on rate limit', async () => {
    MemeGen.GeminiClient.setApiKey('AIzaXX');
    global.fetch = mockFetchHttpError(429, 'Too many requests');

    await expect(
      MemeGen.GeminiClient.generateSuggestions('i', 's', SAMPLE_TEMPLATES)
    ).rejects.toMatchObject({
      name: 'APIError',
      status: 429
    });
  });

  it('rejects with APIError carrying the status code on other 4xx', async () => {
    MemeGen.GeminiClient.setApiKey('AIzaXX');
    global.fetch = mockFetchHttpError(400, 'API key invalid');

    await expect(
      MemeGen.GeminiClient.generateSuggestions('i', 's', SAMPLE_TEMPLATES)
    ).rejects.toMatchObject({
      name: 'APIError',
      status: 400
    });
  });

  it('rejects with NetworkError when fetch rejects', async () => {
    MemeGen.GeminiClient.setApiKey('AIzaXX');
    global.fetch = mockFetchReject(new Error('NetworkError when attempting to fetch resource.'));

    await expect(
      MemeGen.GeminiClient.generateSuggestions('i', 's', SAMPLE_TEMPLATES)
    ).rejects.toBeInstanceOf(MemeGen.GeminiClient.NetworkError);
  });
});

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WORKER_PATH = path.join(__dirname, '..', 'workers', 'tag-meme-worker.js');

class TestResponse {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.headers = init.headers || {};
  }

  json() {
    return Promise.resolve(JSON.parse(this.body || 'null'));
  }
}

function loadWorker({ fetchImpl = jest.fn() } = {}) {
  const source = fs
    .readFileSync(WORKER_PATH, 'utf8')
    .replace('export default', 'module.exports =');

  const context = {
    URL,
    Response: TestResponse,
    console,
    fetch: fetchImpl,
    module: { exports: {} },
    exports: {}
  };

  vm.runInNewContext(source, context, { filename: WORKER_PATH });
  return context.module.exports;
}

function makeTagRequest(body, origin = 'https://cse110-sp26-group18.github.io') {
  return {
    method: 'POST',
    url: 'https://tag-meme-worker.example.workers.dev/tag-meme',
    headers: {
      get: (name) => (name.toLowerCase() === 'origin' ? origin : null)
    },
    json: () => Promise.resolve(body)
  };
}

function makeOptionsRequest(origin) {
  return {
    method: 'OPTIONS',
    url: 'https://tag-meme-worker.example.workers.dev/tag-meme',
    headers: {
      get: (name) => (name.toLowerCase() === 'origin' ? origin : null)
    }
  };
}

function makeKv(initial = {}) {
  const store = new Map(Object.entries(initial));

  return {
    get: jest.fn((key) => Promise.resolve(store.has(key) ? JSON.parse(store.get(key)) : null)),
    put: jest.fn((key, value) => {
      store.set(key, value);
      return Promise.resolve();
    })
  };
}

describe('tag-meme Worker — Gemini provider', () => {
  it('allows localhost CORS preflight during local development', async () => {
    const worker = loadWorker();

    const response = await worker.fetch(
      makeOptionsRequest('http://localhost:5500'),
      {}
    );

    expect(response.status).toBe(204);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('http://localhost:5500');
  });

  it('requires GEMINI_API_KEY to be configured', async () => {
    const worker = loadWorker();

    const response = await worker.fetch(
      makeTagRequest({ id: '1', name: 'Drake Hotline Bling', imageUrl: 'https://example.com/drake.jpg' }),
      {}
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Server is not configured' });
  });

  it('calls Gemini generateContent and returns sanitized tags', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    tags: [' Reaction ', 'choice', 'choice', 'this tag has way too many words here', '']
                  })
                }
              ]
            }
          }
        ]
      })
    });
    const worker = loadWorker({ fetchImpl });

    const response = await worker.fetch(
      makeTagRequest({ id: '181913649', name: 'Drake Hotline Bling', imageUrl: 'https://example.com/drake.jpg' }),
      { GEMINI_API_KEY: 'gemini-test-key' }
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key='),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('Drake Hotline Bling')
      })
    );
    const geminiBody = JSON.parse(fetchImpl.mock.calls[0][1].body);
    const prompt = geminiBody.contents[0].parts[0].text;
    expect(prompt).toContain('focused primarily on emotion and reaction search');
    expect(prompt).toContain('nervous, anxious, worried');
    expect(prompt).toContain('reaction intent');
    expect(prompt).toContain('at most 30 tags');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ tags: ['reaction', 'choice'], cached: false });
  });

  it('allows up to 30 valid generated tags', async () => {
    const tags = Array.from({ length: 31 }, (_, i) => 'tag' + i);
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ tags }) }]
            }
          }
        ]
      })
    });
    const worker = loadWorker({ fetchImpl });

    const response = await worker.fetch(
      makeTagRequest({ id: '181913649', name: 'Drake Hotline Bling', imageUrl: 'https://example.com/drake.jpg' }),
      { GEMINI_API_KEY: 'gemini-test-key' }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.tags).toHaveLength(30);
    expect(body.tags[29]).toBe('tag29');
  });

  it('preserves original Gemini tags before adding emotion expansions', async () => {
    const tags = ['anxious'].concat(
      Array.from({ length: 28 }, (_, i) => 'specific tag ' + i),
      ['specific context']
    );
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ tags }) }]
            }
          }
        ]
      })
    });
    const worker = loadWorker({ fetchImpl });

    const response = await worker.fetch(
      makeTagRequest({ id: '91538330', name: 'X, X Everywhere', imageUrl: 'https://example.com/everywhere.jpg' }),
      { GEMINI_API_KEY: 'gemini-test-key' }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.tags).toHaveLength(30);
    expect(body.tags).toContain('specific context');
    expect(body.tags).not.toContain('nervous');
  });

  it('expands generated emotion tags with search-friendly synonyms', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ tags: ['anxious', 'dilemma'] }) }]
            }
          }
        ]
      })
    });
    const worker = loadWorker({ fetchImpl });

    const response = await worker.fetch(
      makeTagRequest({ id: '87743020', name: 'Two Buttons', imageUrl: 'https://example.com/two-buttons.jpg' }),
      { GEMINI_API_KEY: 'gemini-test-key' }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.tags).toEqual(expect.arrayContaining(['anxious', 'nervous', 'worried', 'stressed', 'panicked']));
  });

  it('expands tense variants for emotion tags before caching', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ tags: ['stress', 'dilemma'] }) }]
            }
          }
        ]
      })
    });
    const worker = loadWorker({ fetchImpl });

    const response = await worker.fetch(
      makeTagRequest({ id: '87743020', name: 'Two Buttons', imageUrl: 'https://example.com/two-buttons.jpg' }),
      { GEMINI_API_KEY: 'gemini-test-key' }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.tags).toEqual(expect.arrayContaining([
      'stress',
      'stressed',
      'stressing',
      'anxious',
      'nervous',
      'worried'
    ]));
  });

  it('expands broader emotion tags for exhaustive search coverage', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ tags: ['bored', 'jealous', 'calm'] }) }]
            }
          }
        ]
      })
    });
    const worker = loadWorker({ fetchImpl });

    const response = await worker.fetch(
      makeTagRequest({ id: '4087833', name: 'Waiting Skeleton', imageUrl: 'https://example.com/waiting.jpg' }),
      { GEMINI_API_KEY: 'gemini-test-key' }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.tags).toEqual(expect.arrayContaining([
      'bored',
      'tired',
      'exhausted',
      'jealous',
      'insecure',
      'calm',
      'relaxed',
      'chill'
    ]));
  });

  it('returns cached KV tags without calling Gemini', async () => {
    const fetchImpl = jest.fn();
    const kv = makeKv({
      'imgflip:181913649': JSON.stringify({
        id: '181913649',
        tags: ['cached', 'reaction']
      })
    });
    const worker = loadWorker({ fetchImpl });

    const response = await worker.fetch(
      makeTagRequest({ id: '181913649', name: 'Drake Hotline Bling', imageUrl: 'https://example.com/drake.jpg' }),
      { GEMINI_API_KEY: 'gemini-test-key', MEME_TAGS_KV: kv }
    );

    expect(kv.get).toHaveBeenCalledWith('imgflip:181913649', { type: 'json' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ tags: ['cached', 'reaction'], cached: true });
  });

  it('stores Gemini tags in KV after a cache miss', async () => {
    const kv = makeKv();
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ tags: ['fresh', 'reaction'] }) }]
            }
          }
        ]
      })
    });
    const worker = loadWorker({ fetchImpl });

    const response = await worker.fetch(
      makeTagRequest({ id: '181913649', name: 'Drake Hotline Bling', imageUrl: 'https://example.com/drake.jpg' }),
      { GEMINI_API_KEY: 'gemini-test-key', MEME_TAGS_KV: kv }
    );

    expect(response.status).toBe(200);
    expect(kv.put).toHaveBeenCalledWith(
      'imgflip:181913649',
      expect.stringContaining('"source":"gemini"')
    );
    const savedRecord = JSON.parse(kv.put.mock.calls[0][1]);
    expect(savedRecord.tags).toEqual(['fresh', 'reaction']);
  });

  it('returns an empty tag list when Gemini fails', async () => {
    const worker = loadWorker({
      fetchImpl: jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({})
      })
    });

    const response = await worker.fetch(
      makeTagRequest({ id: '181913649', name: 'Drake Hotline Bling', imageUrl: 'https://example.com/drake.jpg' }),
      { GEMINI_API_KEY: 'gemini-test-key' }
    );

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.tags).toEqual([]);
    expect(body.error).toContain('Tagging failed');
  });
});

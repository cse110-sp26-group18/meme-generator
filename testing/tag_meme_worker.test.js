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

function makeTagRequest(body) {
  return {
    method: 'POST',
    url: 'https://tag-meme-worker.example.workers.dev/tag-meme',
    json: () => Promise.resolve(body)
  };
}

describe('tag-meme Worker — Gemini provider', () => {
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
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ tags: ['reaction', 'choice'] });
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

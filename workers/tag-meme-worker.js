/**
 * tag-meme-worker.js — Cloudflare Worker for secure AI meme tagging.
 *
 * Why this exists:
 *   The GitHub Pages frontend must never contain the AI provider's API key.
 *   This Worker sits between the browser and the AI provider. The key lives in
 *   Cloudflare as an encrypted Worker secret (env.OPENAI_API_KEY) — it is not in
 *   GitHub, not in the frontend bundle, and never sent to the browser.
 *
 * Endpoint:
 *   POST /tag-meme
 *   Body: { "id": "<imgflip id>", "name": "<template name>", "imageUrl": "<url>" }
 *   200:  { "tags": ["choice", "comparison", "happy", "reaction", ...] }
 *
 * Deploy (from the workers/ directory):
 *   1. Install Wrangler:        npm i -g wrangler   (or use: npx wrangler ...)
 *   2. Store the secret:        wrangler secret put OPENAI_API_KEY
 *        - You'll be prompted to paste the key. It is encrypted and stored in
 *          Cloudflare. It is NOT written to any file and NOT visible in GitHub
 *          or the browser. (Never commit .env / .dev.vars — see .gitignore.)
 *   3. Publish:                 wrangler deploy
 *   4. Copy the printed URL (https://<name>.<subdomain>.workers.dev) and set
 *        AI_TAG_ENDPOINT in meme-app/js/MemeSearch.js to that URL + "/tag-meme".
 *
 * Local dev:
 *   wrangler dev      → serves on http://localhost:8787
 *   For local runs, put the key in a .dev.vars file (OPENAI_API_KEY="sk-..."),
 *   which is gitignored. Do not commit it.
 */

// ───────────────────────────────────────────────────────────────────────────
// CORS
//
// REPLACE this with YOUR GitHub Pages origin, e.g. 'https://your-username.github.io'.
// Note: for a project site (https://your-username.github.io/repo-name/) the
// ORIGIN is still just 'https://your-username.github.io' — the /repo-name/ path
// is NOT part of the origin. Using an exact origin (not '*') means only your
// site can call the Worker.
// ───────────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGIN = 'https://YOUR-GITHUB-USERNAME.github.io';

const AI_MODEL = 'gpt-4o-mini';
const MAX_TAGS = 20;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders())
  });
}

// Lowercase, trim, drop empties/duplicates/over-long, cap the count. The AI is
// asked for clean tags, but we never trust the model's output verbatim.
function sanitizeTags(rawTags) {
  if (!Array.isArray(rawTags)) return [];
  const seen = new Set();
  const out = [];
  for (const t of rawTags) {
    if (typeof t !== 'string') continue;
    const tag = t.toLowerCase().trim();
    // Keep short, single-concept tags; reject sentences and stray punctuation.
    if (!tag || tag.length > 40 || tag.split(/\s+/).length > 4) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

// Validate the request body. Returns { ok: true, value } or { ok: false, error }.
function parseBody(data) {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Body must be a JSON object' };
  }
  const id = data.id;
  const name = data.name;
  const imageUrl = data.imageUrl;
  if (typeof id !== 'string' && typeof id !== 'number') {
    return { ok: false, error: 'Missing or invalid "id"' };
  }
  if (typeof name !== 'string' || !name.trim()) {
    return { ok: false, error: 'Missing or invalid "name"' };
  }
  if (typeof imageUrl !== 'string' || !/^https?:\/\//i.test(imageUrl)) {
    return { ok: false, error: 'Missing or invalid "imageUrl"' };
  }
  return { ok: true, value: { id: String(id), name: name.trim(), imageUrl: imageUrl } };
}

function buildPrompt(name) {
  return [
    'You generate concise search tags for a meme template.',
    'Template name: "' + name + '".',
    '',
    'Return 10-20 short, lowercase search tags describing this meme template.',
    'Include: emotions, visible objects, the meme concept/format, well-known',
    'characters (only if obvious from the name), and common search terms people',
    'would type to find it.',
    '',
    'Rules:',
    '- lowercase only',
    '- short tags (1-3 words), never full sentences',
    '- no duplicates',
    '- no offensive, sexual, hateful, or unsafe tags',
    '- at most 20 tags',
    '',
    'Respond with ONLY a JSON object of the form {"tags": ["tag1","tag2",...]}.'
  ].join('\n');
}

// Call the AI provider and extract a tag array. Defensive throughout: any
// missing field or unparseable content throws, and the handler returns a safe
// fallback so the frontend degrades to name-only search.
function requestTagsFromAI(env, meme) {
  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + env.OPENAI_API_KEY
    },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You output only valid JSON.' },
        { role: 'user', content: buildPrompt(meme.name) }
      ]
    })
  })
    .then(function (resp) {
      if (!resp.ok) throw new Error('AI provider HTTP ' + resp.status);
      return resp.json();
    })
    .then(function (data) {
      var content =
        data &&
        data.choices &&
        data.choices[0] &&
        data.choices[0].message &&
        data.choices[0].message.content;
      if (typeof content !== 'string') throw new Error('No content in AI response');

      var parsed;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        throw new Error('AI response was not valid JSON');
      }
      return sanitizeTags(parsed && parsed.tags);
    });
}

export default {
  fetch: function (request, env) {
    // CORS preflight.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Use POST /tag-meme' }, 405);
    }

    var url = new URL(request.url);
    if (url.pathname !== '/tag-meme') {
      return jsonResponse({ error: 'Not found' }, 404);
    }

    if (!env || !env.OPENAI_API_KEY) {
      return jsonResponse({ error: 'Server is not configured' }, 500);
    }

    return request
      .json()
      .catch(function () {
        return null;
      })
      .then(function (data) {
        var parsed = parseBody(data);
        if (!parsed.ok) {
          return jsonResponse({ error: parsed.error }, 400);
        }
        return requestTagsFromAI(env, parsed.value)
          .then(function (tags) {
            return jsonResponse({ tags: tags });
          })
          .catch(function (err) {
            // Never leak provider internals; the frontend treats this as a
            // soft failure and keeps the meme searchable by name.
            return jsonResponse({ tags: [], error: 'Tagging failed: ' + err.message }, 502);
          });
      });
  }
};

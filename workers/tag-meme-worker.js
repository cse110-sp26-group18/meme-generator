/**
 * tag-meme-worker.js — Cloudflare Worker for secure AI meme tagging.
 *
 * Why this exists:
 *   The GitHub Pages frontend must never contain the AI provider's API key.
 *   This Worker sits between the browser and the AI provider. The key lives in
 *   Cloudflare as an encrypted Worker secret (env.GEMINI_API_KEY) — it is not in
 *   GitHub, not in the frontend bundle, and never sent to the browser.
 *
 * Endpoint:
 *   POST /tag-meme
 *   Body: { "id": "<imgflip id>", "name": "<template name>", "imageUrl": "<url>" }
 *   200:  { "tags": ["choice", "comparison", "happy", "reaction", ...] }
 *
 * Generated tags are cached in Workers KV by Imgflip id so Gemini only needs
 * to tag each template once. Later users get the shared cached tags.
 *
 * Deploy (from the workers/ directory):
 *   1. Install Wrangler:        npm i -g wrangler   (or use: npx wrangler ...)
 *   2. Store the secret:        wrangler secret put GEMINI_API_KEY
 *        - You'll be prompted to paste the key. It is encrypted and stored in
 *          Cloudflare. It is NOT written to any file and NOT visible in GitHub
 *          or the browser. (Never commit .env / .dev.vars — see .gitignore.)
 *   3. Publish:                 wrangler deploy
 *   4. Copy the printed URL (https://<name>.<subdomain>.workers.dev) and set
 *        window.MemeGenConfig.aiTagEndpoint to that URL + "/tag-meme" before
 *        MemeSearch.init() runs, or pass it as init({ aiTagEndpoint }).
 *
 * Local dev:
 *   wrangler dev      → serves on http://localhost:8787
 *   For local runs, put the key in a .dev.vars file (GEMINI_API_KEY="..."),
 *   which is gitignored. Do not commit it.
 */

// ───────────────────────────────────────────────────────────────────────────
// CORS
//
// Note: for a project site (https://your-username.github.io/repo-name/) the
// ORIGIN is still just 'https://your-username.github.io' — the /repo-name/ path
// is NOT part of the origin. Localhost entries support local development.
// ───────────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://cse110-sp26-group18.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
];

const AI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';
const MAX_TAGS = 30;

const EMOTION_TAG_EXPANSIONS = {
  nervous: ['anxious', 'worried', 'stressed', 'panicked', 'sweating', 'overwhelmed'],
  anxious: ['nervous', 'worried', 'stressed', 'panicked'],
  worried: ['nervous', 'anxious', 'concerned', 'stressed'],
  stress: ['stressed', 'stressing', 'anxious', 'nervous', 'worried', 'overwhelmed', 'pressure'],
  stressed: ['nervous', 'anxious', 'overwhelmed', 'frustrated'],
  stressing: ['stress', 'stressed', 'anxious', 'nervous', 'worried'],
  panicked: ['nervous', 'scared', 'anxious', 'overwhelmed'],
  scare: ['scared', 'scary', 'afraid', 'fear', 'terrified'],
  scared: ['afraid', 'terrified', 'nervous', 'anxious', 'panicked'],
  scary: ['scared', 'afraid', 'fear', 'terrified'],
  terrified: ['scared', 'afraid', 'panicked'],
  anger: ['angry', 'mad', 'annoyed', 'frustrated', 'furious', 'rage'],
  angry: ['mad', 'annoyed', 'frustrated', 'furious', 'rage'],
  annoyed: ['angry', 'frustrated', 'irritated'],
  frustrated: ['angry', 'annoyed', 'stressed'],
  frustration: ['frustrated', 'annoyed', 'angry', 'stressed'],
  sadness: ['sad', 'upset', 'disappointed', 'depressed', 'crying', 'heartbroken'],
  sad: ['upset', 'disappointed', 'depressed', 'crying', 'heartbroken', 'lonely'],
  disappointed: ['sad', 'upset', 'frustrated'],
  surprise: ['surprised', 'shocked', 'stunned', 'astonished', 'unexpected'],
  surprised: ['shocked', 'stunned', 'astonished', 'speechless', 'unexpected'],
  shocked: ['surprised', 'stunned', 'disbelief'],
  confusion: ['confused', 'puzzled', 'uncertain', 'lost'],
  confused: ['puzzled', 'uncertain', 'lost', 'disbelief'],
  embarrassment: ['embarrassed', 'awkward', 'cringe', 'ashamed'],
  embarrassed: ['awkward', 'cringe', 'ashamed', 'uncomfortable'],
  happy: ['joyful', 'excited', 'pleased', 'proud', 'relieved'],
  excited: ['happy', 'joyful', 'eager', 'hyped', 'thrilled'],
  excitement: ['excited', 'happy', 'joyful', 'eager', 'hyped', 'thrilled'],
  bored: ['tired', 'uninterested', 'waiting', 'dull', 'exhausted'],
  boredom: ['bored', 'tired', 'uninterested', 'waiting', 'dull'],
  disgusted: ['grossed out', 'repulsed', 'dislike', 'reject'],
  jealous: ['envy', 'insecure', 'resentful', 'betrayal'],
  jealousy: ['jealous', 'envy', 'insecure', 'resentful'],
  lonely: ['alone', 'isolated', 'sad', 'empty'],
  hopeful: ['optimistic', 'wishful', 'eager', 'encouraged'],
  proud: ['confident', 'satisfied', 'accomplished', 'victorious'],
  calm: ['relaxed', 'peaceful', 'unbothered', 'chill'],
  overwhelmed: ['stressed', 'anxious', 'panicked', 'too much'],
  overwhelm: ['overwhelmed', 'stressed', 'anxious', 'panicked', 'too much'],
  exhausted: ['tired', 'drained', 'bored', 'burned out'],
  relieved: ['calm', 'grateful', 'safe', 'reassured'],
  guilty: ['ashamed', 'embarrassed', 'regret', 'caught'],
  suspicious: ['doubtful', 'skeptical', 'judgment', 'side eye'],
  smug: ['confident', 'self satisfied', 'proud', 'superior'],
  awkward: ['embarrassed', 'cringe', 'uncomfortable'],
  cringe: ['awkward', 'embarrassed', 'uncomfortable'],
  heartbroken: ['sad', 'devastated', 'lonely'],
  devastated: ['heartbroken', 'sad', 'shocked']
};

const EMOTION_TAG_INFLECTIONS = {
  stress: ['stressed', 'stressing'],
  stressed: ['stress', 'stressing'],
  stressing: ['stress', 'stressed'],
  panic: ['panicked', 'panicking'],
  panicked: ['panic', 'panicking'],
  panicking: ['panic', 'panicked'],
  worry: ['worried', 'worrying'],
  worried: ['worry', 'worrying'],
  worrying: ['worry', 'worried'],
  scare: ['scared', 'scary'],
  scared: ['scare', 'scary'],
  scary: ['scare', 'scared'],
  confuse: ['confused', 'confusion'],
  confused: ['confuse', 'confusion'],
  confusion: ['confuse', 'confused'],
  embarrass: ['embarrassed', 'embarrassment'],
  embarrassed: ['embarrass', 'embarrassment'],
  embarrassment: ['embarrass', 'embarrassed'],
  excite: ['excited', 'excitement'],
  excited: ['excite', 'excitement'],
  excitement: ['excite', 'excited'],
  bore: ['bored', 'boredom'],
  bored: ['bore', 'boredom'],
  boredom: ['bore', 'bored'],
  frustrate: ['frustrated', 'frustration'],
  frustrated: ['frustrate', 'frustration'],
  frustration: ['frustrate', 'frustrated'],
  disappoint: ['disappointed', 'disappointment'],
  disappointed: ['disappoint', 'disappointment'],
  disappointment: ['disappoint', 'disappointed'],
  overwhelm: ['overwhelmed', 'overwhelming'],
  overwhelmed: ['overwhelm', 'overwhelming'],
  overwhelming: ['overwhelm', 'overwhelmed'],
  exhaust: ['exhausted', 'exhaustion'],
  exhausted: ['exhaust', 'exhaustion'],
  exhaustion: ['exhaust', 'exhausted']
};

function getAllowedOrigin(request) {
  var origin = request.headers.get('Origin');
  return ALLOWED_ORIGINS.indexOf(origin) !== -1 ? origin : ALLOWED_ORIGINS[0];
}

function corsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(request),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function jsonResponse(request, body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(request))
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

function expandEmotionTags(rawTags) {
  if (!Array.isArray(rawTags)) return [];
  const expanded = [];
  for (const tag of rawTags) {
    expanded.push(tag);
    const clean = typeof tag === 'string' ? tag.toLowerCase().trim() : '';
    const inflections = EMOTION_TAG_INFLECTIONS[clean];
    if (inflections) expanded.push.apply(expanded, inflections);
    const related = EMOTION_TAG_EXPANSIONS[clean];
    if (related) {
      expanded.push.apply(expanded, related);
      for (const relatedTag of related) {
        const relatedInflections = EMOTION_TAG_INFLECTIONS[relatedTag];
        if (relatedInflections) expanded.push.apply(expanded, relatedInflections);
      }
    }
  }
  return sanitizeTags(expanded);
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
    'You generate exhaustive search tags for a meme template.',
    'Template name: "' + name + '".',
    '',
    'Return 20-30 short, lowercase tags focused primarily on emotion and reaction search.',
    '',
    'Prioritize these tag types:',
    '- emotions: happy, sad, angry, confused, shocked, scared, nervous, anxious, worried, embarrassed, disappointed, excited, smug, annoyed, frustrated, overwhelmed, bored, disgusted, jealous, lonely, hopeful, proud, calm, exhausted, relieved, guilty, suspicious',
    '- reaction intent: approval, disapproval, rejection, acceptance, disbelief, agreement, disagreement, judgment',
    '- facial expression or body language if implied by the template name',
    '- social situation: argument, awkward, cringe, celebration, failure, success, waiting, betrayal',
    '- meme format or concept: comparison, choice, dilemma, reaction, two panel, four panel',
    '- well-known character/person names only if obvious from the template name',
    '',
    'Add useful synonyms so users can find templates by emotion.',
    'For nervous also include anxious, worried, stressed, panicked, sweating, or overwhelmed when appropriate.',
    'For sad also include disappointed, upset, crying, depressed when appropriate.',
    'For angry also include mad, annoyed, frustrated, rage when appropriate.',
    '',
    'Rules:',
    '- lowercase only',
    '- short tags, 1-3 words',
    '- never full sentences',
    '- no duplicates',
    '- no offensive, sexual, hateful, or unsafe tags',
    '- at most 30 tags',
    '',
    'Respond with ONLY a JSON object of the form {"tags": ["tag1","tag2",...]}.'
  ].join('\n');
}

function extractJsonObject(text) {
  if (typeof text !== 'string') throw new Error('No content in AI response');
  var trimmed = text.trim();
  var match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

function tagCacheKey(id) {
  return 'imgflip:' + id;
}

function readTagsFromCache(env, meme) {
  if (!env || !env.MEME_TAGS_KV) return Promise.resolve(null);

  return env.MEME_TAGS_KV
    .get(tagCacheKey(meme.id), { type: 'json' })
    .then(function (record) {
      if (!record || !Array.isArray(record.tags) || !record.tags.length) return null;
      return sanitizeTags(record.tags);
    })
    .catch(function () {
      return null;
    });
}

function writeTagsToCache(env, meme, tags) {
  if (!env || !env.MEME_TAGS_KV || !tags.length) return Promise.resolve();

  var record = {
    id: meme.id,
    name: meme.name,
    imageUrl: meme.imageUrl,
    tags: tags,
    source: 'gemini',
    updatedAt: new Date().toISOString()
  };

  return env.MEME_TAGS_KV
    .put(tagCacheKey(meme.id), JSON.stringify(record))
    .catch(function () {
      /* Cache writes are helpful but non-fatal. */
    });
}

// Call the AI provider and extract a tag array. Defensive throughout: any
// missing field or unparseable content throws, and the handler returns a safe
// fallback so the frontend degrades to name-only search.
function requestTagsFromAI(env, meme) {
  var endpoint = GEMINI_API_BASE_URL + encodeURIComponent(AI_MODEL) + ':generateContent?key=' +
    encodeURIComponent(env.GEMINI_API_KEY);

  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: buildPrompt(meme.name) }]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json'
      }
    })
  })
    .then(function (resp) {
      if (!resp.ok) throw new Error('AI provider HTTP ' + resp.status);
      return resp.json();
    })
    .then(function (data) {
      var content =
        data &&
        data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts[0] &&
        data.candidates[0].content.parts[0].text;
      if (typeof content !== 'string') throw new Error('No content in AI response');

      var parsed;
      try {
        parsed = JSON.parse(extractJsonObject(content));
      } catch (e) {
        throw new Error('AI response was not valid JSON');
      }
      return expandEmotionTags(parsed && parsed.tags);
    });
}

export default {
  fetch: function (request, env) {
    // CORS preflight.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (request.method !== 'POST') {
      return jsonResponse(request, { error: 'Use POST /tag-meme' }, 405);
    }

    var url = new URL(request.url);
    if (url.pathname !== '/tag-meme') {
      return jsonResponse(request, { error: 'Not found' }, 404);
    }

    if (!env || !env.GEMINI_API_KEY) {
      return jsonResponse(request, { error: 'Server is not configured' }, 500);
    }

    return request
      .json()
      .catch(function () {
        return null;
      })
      .then(function (data) {
        var parsed = parseBody(data);
        if (!parsed.ok) {
          return jsonResponse(request, { error: parsed.error }, 400);
        }
        return readTagsFromCache(env, parsed.value)
          .then(function (cachedTags) {
            if (cachedTags) {
              return jsonResponse(request, { tags: cachedTags, cached: true });
            }

            return requestTagsFromAI(env, parsed.value)
              .then(function (tags) {
                return writeTagsToCache(env, parsed.value, tags).then(function () {
                  return jsonResponse(request, { tags: tags, cached: false });
                });
              });
          })
          .catch(function (err) {
            // Never leak provider internals; the frontend treats this as a
            // soft failure and keeps the meme searchable by name.
            return jsonResponse(request, { tags: [], error: 'Tagging failed: ' + err.message }, 502);
          });
      });
  }
};

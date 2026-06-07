/**
 * GeminiClient — thin browser-side wrapper around the Google Gemini API.
 *
 * Public API (exposed on window.MemeGen.GeminiClient):
 *   hasApiKey()                                   -> boolean
 *   getApiKey()                                   -> string | null
 *   setApiKey(key)                                -> void
 *   clearApiKey()                                 -> void
 *   buildRequestBody(identity, situation, templates) -> object
 *   generateSuggestions(identity, situation, templates)
 *       -> Promise<Array<{template_id: string, captions: string[]}>>
 *
 * Errors are real Error subclasses so callers can `instanceof`-check:
 *   KeyError      — no API key set
 *   NetworkError  — fetch rejected (no network, DNS, etc.)
 *   APIError      — HTTP non-2xx; .status is the response status
 *   ParseError    — Gemini returned malformed or empty data
 *
 * Key handling: the user pastes their own free-tier Gemini key on first use.
 * It is stored in localStorage under `mg.geminiApiKey` — only on their own
 * device. The static site has no server, so per-user keys are the only safe
 * option that ships publicly.
 */
var MemeGen = window.MemeGen || {};

MemeGen.GeminiClient = (function () {
  var STORAGE_KEY = 'mg.geminiApiKey';
  // gemini-2.5-flash is the current generally-available free-tier model.
  // gemini-2.0-flash is currently quota-locked to 0 on new keys.
  var MODEL = 'gemini-2.5-flash';
  var ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

  // ── Error classes ───────────────────────────────────────────────────────────

  function KeyError(message) {
    this.name = 'KeyError';
    this.message = message || 'Gemini API key is not set.';
    this.stack = (new Error()).stack;
  }
  KeyError.prototype = Object.create(Error.prototype);
  KeyError.prototype.constructor = KeyError;

  function NetworkError(message) {
    this.name = 'NetworkError';
    this.message = message || 'Network request failed.';
    this.stack = (new Error()).stack;
  }
  NetworkError.prototype = Object.create(Error.prototype);
  NetworkError.prototype.constructor = NetworkError;

  function APIError(message, status) {
    this.name = 'APIError';
    this.message = message || 'Gemini API returned an error.';
    this.status = status;
    this.stack = (new Error()).stack;
  }
  APIError.prototype = Object.create(Error.prototype);
  APIError.prototype.constructor = APIError;

  function ParseError(message) {
    this.name = 'ParseError';
    this.message = message || 'Gemini response could not be parsed.';
    this.stack = (new Error()).stack;
  }
  ParseError.prototype = Object.create(Error.prototype);
  ParseError.prototype.constructor = ParseError;

  // ── Key storage ─────────────────────────────────────────────────────────────

  function getApiKey() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function setApiKey(key) {
    var trimmed = (key || '').trim();
    if (!trimmed) return;
    // Private-browsing / cookie-blocked contexts throw on Storage writes.
    // Match getApiKey's defensive shape — best-effort, no surfacing.
    try { window.localStorage.setItem(STORAGE_KEY, trimmed); } catch { /* ignore */ }
  }

  function clearApiKey() {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  function hasApiKey() {
    var k = getApiKey();
    return !!(k && k.trim());
  }

  // ── Prompt construction ─────────────────────────────────────────────────────

  var SYSTEM_INSTRUCTION =
    'You are a meme-suggestion assistant. From the supplied list of meme ' +
    'templates, pick exactly 3 templates that best fit the user\'s situation. ' +
    'For each pick, generate exactly 2 short caption strings: the first is ' +
    'the top caption, the second is the bottom caption. Each caption must be ' +
    'under 8 words. You MUST set template_id to a value that appears verbatim ' +
    'in the supplied list — do not invent template ids. Return only the JSON ' +
    'object defined by the schema.';

  var RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
      suggestions: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            template_id: { type: 'STRING' },
            captions: {
              type: 'ARRAY',
              items: { type: 'STRING' }
            }
          },
          required: ['template_id', 'captions']
        }
      }
    },
    required: ['suggestions']
  };

  function templateLine(t) {
    // Templates may carry rich metadata (character/emotion/tags) OR just a
    // name (e.g. ImgFlip memes whose entire identity is their cultural
    // reference). Build the line from whichever fields are present.
    var parts = [t.id];
    if (t.name && t.name !== t.id) parts.push('"' + t.name + '"');
    if (t.character) parts.push(t.character);
    if (t.emotion) parts.push(t.emotion);
    if (Array.isArray(t.tags) && t.tags.length) parts.push(t.tags.join(', '));
    return '- ' + parts.join(' — ');
  }

  function buildUserPrompt(identity, situation, templates) {
    var list = templates.map(templateLine).join('\n');
    return (
      'The user describes themselves as: "' + identity + '"\n' +
      'Their situation: "' + situation + '"\n\n' +
      'Available templates (id — character — emotion — tags):\n' +
      list + '\n\n' +
      'Pick exactly 3 templates that best match. Return JSON matching the schema.'
    );
  }

  function buildRequestBody(identity, situation, templates) {
    return {
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [
        { role: 'user', parts: [{ text: buildUserPrompt(identity, situation, templates) }] }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.9
      }
    };
  }

  // ── Response parsing ────────────────────────────────────────────────────────

  /**
   * Strip a markdown code fence (```json ... ``` or ``` ... ```) if present.
   * Gemini occasionally wraps JSON in a fence even when responseMimeType is
   * application/json.
   */
  function stripJsonFence(text) {
    if (typeof text !== 'string') return text;
    var trimmed = text.trim();
    var fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    return fenceMatch ? fenceMatch[1].trim() : trimmed;
  }

  /**
   * Extract the JSON text payload from Gemini's nested response envelope.
   * Returns the raw text string; parsing happens in parseSuggestions().
   */
  function extractText(result) {
    if (!result || !Array.isArray(result.candidates) || !result.candidates[0]) {
      throw new ParseError('Gemini response missing candidates[0].');
    }
    var content = result.candidates[0].content;
    if (!content || !Array.isArray(content.parts) || !content.parts[0]) {
      throw new ParseError('Gemini response missing candidates[0].content.parts[0].');
    }
    var text = content.parts[0].text;
    if (typeof text !== 'string') {
      throw new ParseError('Gemini response part did not contain a text field.');
    }
    return text;
  }

  function parseSuggestions(rawText, templates) {
    var stripped = stripJsonFence(rawText);
    var parsed;
    try {
      parsed = JSON.parse(stripped);
    } catch (e) {
      throw new ParseError('Gemini returned malformed JSON: ' + e.message);
    }
    if (!parsed || !Array.isArray(parsed.suggestions)) {
      throw new ParseError('Gemini response missing suggestions array.');
    }

    var validIds = {};
    templates.forEach(function (t) { validIds[t.id] = true; });

    var valid = parsed.suggestions.filter(function (s) {
      return s &&
        typeof s.template_id === 'string' &&
        validIds[s.template_id] &&
        Array.isArray(s.captions) &&
        s.captions.length > 0;
    });

    if (valid.length === 0) {
      throw new ParseError('Gemini returned no usable suggestions.');
    }

    return valid.slice(0, 3);
  }

  // ── Public: generateSuggestions ─────────────────────────────────────────────

  function generateSuggestions(identity, situation, templates) {
    var key = getApiKey();
    if (!key || !key.trim()) {
      return Promise.reject(new KeyError());
    }

    var url = ENDPOINT_BASE + MODEL + ':generateContent?key=' + encodeURIComponent(key);
    var body = buildRequestBody(identity, situation, templates);

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (response) {
      // fetch resolves for HTTP errors too — they're not network failures.
      if (!response.ok) {
        var status = response.status;
        return response.text().then(function (text) {
          throw new APIError('Gemini HTTP ' + status + ': ' + text.slice(0, 200), status);
        }, function () {
          throw new APIError('Gemini HTTP ' + status, status);
        });
      }
      return response.json();
    }, function (fetchErr) {
      // fetch rejects only for genuine network failures.
      throw new NetworkError(fetchErr && fetchErr.message ? fetchErr.message : 'Network request failed.');
    }).then(function (result) {
      var rawText = extractText(result);
      return parseSuggestions(rawText, templates);
    });
  }

  return {
    // Key storage
    getApiKey: getApiKey,
    setApiKey: setApiKey,
    clearApiKey: clearApiKey,
    hasApiKey: hasApiKey,

    // Core
    generateSuggestions: generateSuggestions,
    buildRequestBody: buildRequestBody,

    // Internals exposed for tests
    _stripJsonFence: stripJsonFence,
    _parseSuggestions: parseSuggestions,
    _SYSTEM_INSTRUCTION: SYSTEM_INSTRUCTION,
    _RESPONSE_SCHEMA: RESPONSE_SCHEMA,

    // Error classes
    KeyError: KeyError,
    NetworkError: NetworkError,
    APIError: APIError,
    ParseError: ParseError
  };
})();

window.MemeGen = MemeGen;

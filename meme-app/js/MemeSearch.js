var MemeGen = window.MemeGen || {};

/**
 * MemeSearch
 *
 * Combines two template sources into one searchable grid:
 *   1. Popular meme templates from Imgflip's public `get_memes` endpoint
 *      (no API key required for read-only access).
 *   2. The project's own internal library from assets/templates/templates.json.
 *
 * Both lists are fetched once, merged, and cached, then filtered client-side
 * by name (and, for internal templates, also by character/emotion/tags) — no
 * per-keystroke network calls. Selecting a result invokes the onSelect
 * callback with the chosen template so the host app can load it onto the canvas.
 *
 * Imgflip templates carry no tags from the API, so search would otherwise only
 * match their name. Tags are resolved from localStorage first, then from the
 * Cloudflare Worker. The Worker keeps a shared KV cache and calls Gemini only
 * for memes that do not already have shared tags.
 *
 * If the Worker is unconfigured, the legacy committed tag file is used as a
 * fallback for local/static development. Cloud tagging is cost-capped: only the
 * first few untagged templates are sent, slowly, one at a time, in the
 * background. If the Worker fails, the affected meme still renders and stays
 * searchable by name.
 */
MemeGen.MemeSearch = (function () {
  var ENDPOINT = 'https://api.imgflip.com/get_memes';

  // index.html lives in meme-app/, while templates.json + its images live in
  // the sibling assets/ folder, so the repo-root-relative paths in the JSON
  // need a leading "../" when loaded from the page.
  var IMGFLIP_TAGS_PATH = '../assets/templates/imgflip-tags.json';
  var TEMPLATES_PATH = '../assets/templates/templates.json';
  var ASSET_PREFIX = '../';

  // Public Cloudflare Worker URL that performs AI tagging. Safe to ship: it
  // holds no secret, only the Worker endpoint. The Gemini key lives inside
  // Cloudflare. Leave blank to disable cloud tagging.
  var aiTagEndpoint = '';

  // localStorage key for tags generated on previous visits. Versioned so the
  // shape can change later without colliding with old cached data.
  var LOCAL_TAG_CACHE_KEY = 'memeSearch.imgflipTags.v1';

  // Cost protection for cloud tagging: never tag more than this many templates
  // per session, and space the calls out so we don't hammer the Worker / AI.
  var MAX_CLOUD_TAGS = 10;
  var CLOUD_TAG_DELAY_MS = 1500;
  var MAX_TAGS = 20;

  // Cached templates and fetch state.
  var memes = [];
  var fetched = false;
  var fetching = false;

  var EMOTION_QUERY_EXPANSIONS = {
    nervous: ['nervous', 'anxious', 'worried', 'stressed', 'panicked', 'panic', 'sweating', 'pressure', 'overwhelmed', 'scared'],
    anxious: ['anxious', 'nervous', 'worried', 'stressed', 'panicked', 'overwhelmed'],
    worried: ['worried', 'nervous', 'anxious', 'concerned', 'stressed', 'scared'],
    stress: ['stress', 'stressed', 'stressing', 'anxious', 'nervous', 'worried', 'overwhelmed', 'pressure'],
    stressed: ['stressed', 'stress', 'stressing', 'anxious', 'nervous', 'worried', 'overwhelmed', 'pressure'],
    stressing: ['stressing', 'stress', 'stressed', 'anxious', 'nervous', 'worried'],
    scared: ['scared', 'afraid', 'fear', 'terrified', 'nervous', 'anxious', 'panicked'],
    scare: ['scare', 'scared', 'scary', 'afraid', 'fear', 'terrified'],
    scary: ['scary', 'scared', 'afraid', 'fear', 'terrified'],
    angry: ['angry', 'mad', 'annoyed', 'frustrated', 'furious', 'rage'],
    anger: ['anger', 'angry', 'mad', 'annoyed', 'frustrated', 'furious', 'rage'],
    sad: ['sad', 'upset', 'disappointed', 'depressed', 'crying', 'heartbroken', 'lonely'],
    sadness: ['sadness', 'sad', 'upset', 'disappointed', 'depressed', 'crying', 'heartbroken'],
    surprised: ['surprised', 'shocked', 'stunned', 'astonished', 'speechless', 'unexpected'],
    surprise: ['surprise', 'surprised', 'shocked', 'stunned', 'astonished', 'unexpected'],
    confused: ['confused', 'puzzled', 'uncertain', 'lost', 'disbelief'],
    confusion: ['confusion', 'confused', 'puzzled', 'uncertain', 'lost'],
    embarrassed: ['embarrassed', 'awkward', 'cringe', 'ashamed', 'uncomfortable'],
    embarrassment: ['embarrassment', 'embarrassed', 'awkward', 'cringe', 'ashamed'],
    happy: ['happy', 'joyful', 'excited', 'pleased', 'proud', 'relieved'],
    excited: ['excited', 'happy', 'joyful', 'eager', 'hyped', 'thrilled'],
    excitement: ['excitement', 'excited', 'happy', 'joyful', 'eager', 'hyped', 'thrilled'],
    bored: ['bored', 'tired', 'uninterested', 'waiting', 'dull', 'exhausted'],
    boredom: ['boredom', 'bored', 'tired', 'uninterested', 'waiting', 'dull'],
    disgusted: ['disgusted', 'grossed out', 'repulsed', 'dislike', 'reject'],
    jealous: ['jealous', 'envy', 'insecure', 'resentful', 'betrayal'],
    jealousy: ['jealousy', 'jealous', 'envy', 'insecure', 'resentful'],
    lonely: ['lonely', 'alone', 'isolated', 'sad', 'empty'],
    hopeful: ['hopeful', 'optimistic', 'wishful', 'eager', 'encouraged'],
    proud: ['proud', 'confident', 'satisfied', 'accomplished', 'victorious'],
    calm: ['calm', 'relaxed', 'peaceful', 'unbothered', 'chill'],
    overwhelmed: ['overwhelmed', 'stressed', 'anxious', 'panicked', 'too much'],
    overwhelm: ['overwhelm', 'overwhelmed', 'stressed', 'anxious', 'panicked', 'too much'],
    exhausted: ['exhausted', 'tired', 'drained', 'bored', 'burned out'],
    relieved: ['relieved', 'calm', 'grateful', 'safe', 'reassured'],
    guilty: ['guilty', 'ashamed', 'embarrassed', 'regret', 'caught'],
    suspicious: ['suspicious', 'doubtful', 'skeptical', 'judgment', 'side eye'],
    smug: ['smug', 'confident', 'self satisfied', 'proud', 'superior'],
    awkward: ['awkward', 'embarrassed', 'cringe', 'uncomfortable'],
    cringe: ['cringe', 'awkward', 'embarrassed', 'uncomfortable'],
    shocked: ['shocked', 'surprised', 'stunned', 'disbelief', 'speechless'],
    frustrated: ['frustrated', 'annoyed', 'angry', 'stressed'],
    frustration: ['frustration', 'frustrated', 'annoyed', 'angry', 'stressed'],
    disappointed: ['disappointed', 'sad', 'upset', 'let down'],
    terrified: ['terrified', 'scared', 'afraid', 'panicked'],
    furious: ['furious', 'angry', 'mad', 'rage'],
    heartbroken: ['heartbroken', 'sad', 'devastated', 'lonely'],
    devastated: ['devastated', 'heartbroken', 'sad', 'shocked']
  };

  var EMOTION_INFLECTIONS = {
    stress: ['stress', 'stressed', 'stressing'],
    stressed: ['stress', 'stressed', 'stressing'],
    stressing: ['stress', 'stressed', 'stressing'],
    panic: ['panic', 'panicked', 'panicking'],
    panicked: ['panic', 'panicked', 'panicking'],
    panicking: ['panic', 'panicked', 'panicking'],
    worry: ['worry', 'worried', 'worrying'],
    worried: ['worry', 'worried', 'worrying'],
    worrying: ['worry', 'worried', 'worrying'],
    scare: ['scare', 'scared', 'scary'],
    scared: ['scare', 'scared', 'scary'],
    scary: ['scare', 'scared', 'scary'],
    confuse: ['confuse', 'confused', 'confusion'],
    confused: ['confuse', 'confused', 'confusion'],
    confusion: ['confuse', 'confused', 'confusion'],
    embarrass: ['embarrass', 'embarrassed', 'embarrassment'],
    embarrassed: ['embarrass', 'embarrassed', 'embarrassment'],
    embarrassment: ['embarrass', 'embarrassed', 'embarrassment'],
    excite: ['excite', 'excited', 'excitement'],
    excited: ['excite', 'excited', 'excitement'],
    excitement: ['excite', 'excited', 'excitement'],
    bore: ['bore', 'bored', 'boredom'],
    bored: ['bore', 'bored', 'boredom'],
    boredom: ['bore', 'bored', 'boredom'],
    frustrate: ['frustrate', 'frustrated', 'frustration'],
    frustrated: ['frustrate', 'frustrated', 'frustration'],
    frustration: ['frustrate', 'frustrated', 'frustration'],
    disappoint: ['disappoint', 'disappointed', 'disappointment'],
    disappointed: ['disappoint', 'disappointed', 'disappointment'],
    disappointment: ['disappoint', 'disappointed', 'disappointment'],
    overwhelm: ['overwhelm', 'overwhelmed', 'overwhelming'],
    overwhelmed: ['overwhelm', 'overwhelmed', 'overwhelming'],
    overwhelming: ['overwhelm', 'overwhelmed', 'overwhelming'],
    exhaust: ['exhaust', 'exhausted', 'exhaustion'],
    exhausted: ['exhaust', 'exhausted', 'exhaustion'],
    exhaustion: ['exhaust', 'exhausted', 'exhaustion']
  };

  var PHRASE_QUERY_EXPANSIONS = {
    'lets go': ['excited', 'hyped', 'thrilled', 'celebration', 'victorious', 'success'],
    'let us go': ['excited', 'hyped', 'thrilled', 'celebration', 'victorious', 'success'],
    'so sad': ['sad', 'upset', 'disappointed', 'crying'],
    'thats sad': ['sad', 'upset', 'disappointed', 'crying'],
    'that is sad': ['sad', 'upset', 'disappointed', 'crying'],
    'i am sad': ['sad', 'upset', 'disappointed', 'crying'],
    'im sad': ['sad', 'upset', 'disappointed', 'crying'],
    'i am stressed': ['stressed', 'stress', 'anxious', 'nervous', 'worried'],
    'im stressed': ['stressed', 'stress', 'anxious', 'nervous', 'worried'],
    'too much': ['overwhelmed', 'stressed', 'anxious', 'panicked'],
    'no way': ['shocked', 'surprised', 'disbelief'],
    'oh no': ['scared', 'worried', 'panicked', 'sad'],
    'what the': ['confused', 'shocked', 'disbelief'],
    'bruh moment': ['disappointed', 'awkward', 'cringe', 'disbelief']
  };

  var QUERY_FILLER_WORDS = {
    a: true,
    about: true,
    am: true,
    an: true,
    and: true,
    are: true,
    feel: true,
    feeling: true,
    feels: true,
    for: true,
    i: true,
    im: true,
    is: true,
    just: true,
    kinda: true,
    like: true,
    me: true,
    really: true,
    so: true,
    super: true,
    that: true,
    the: true,
    this: true,
    too: true,
    very: true
  };

  // Tag cache loaded from localStorage (id -> string[]). Mutated as the Worker
  // returns new tags, then persisted via saveLocalTagCache().
  var localTagCache = {};

  // Background cloud-tagging queue state.
  var tagQueue = [];
  var queueRunning = false;

  // DOM references and callback set during init().
  var inputEl = null;
  var resultsEl = null;
  var statusEl = null;
  var onSelectCallback = null;
  var onFetchedCallback = null;

  /**
   * Wire up the search UI.
   *  opts.input    — text input element
   *  opts.results  — container element that will hold the result cards
   *  opts.status   — element used for loading / empty / error messages
   *  opts.onSelect — function(meme) called when a result card is clicked
   *  opts.onFetched — function(memes) called after the merged library loads
   *  opts.aiTagEndpoint — optional Worker URL for background AI tagging
   */
  function init(opts) {
    inputEl = opts.input;
    resultsEl = opts.results;
    statusEl = opts.status;
    onSelectCallback = opts.onSelect || null;
    onFetchedCallback = opts.onFetched || null;
    aiTagEndpoint = resolveAiTagEndpoint(opts);

    if (fetched && onFetchedCallback) {
      onFetchedCallback(memes.slice());
    }

    // Simple debounce so we don't re-render on every keystroke.
    var debounceTimer = null;
    inputEl.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runSearch, 150);
    });

    // Enter triggers an immediate search.
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(debounceTimer);
        runSearch();
      }
    });

    // Fetch lazily on first focus so we don't slow initial page load.
    inputEl.addEventListener('focus', ensureFetched);
    ensureFetched();
  }

  // Fetch every source once, merge, and cache. Imgflip is the primary source
  // but the internal library is a fallback: if Imgflip fails we still show the
  // internal templates. The tag file is best-effort and never blocks rendering.
  function ensureFetched() {
    if (fetched || fetching) return;
    fetching = true;
    setStatus('Loading memes…');

    Promise.allSettled([fetchImgflipMemes(), fetchImgflipTags(), fetchLocalTemplates()])
      .then(function (results) {
        var raws = results[0].status === 'fulfilled' ? results[0].value : [];
        var fileTagMap = !cloudTaggingEnabled() && results[1].status === 'fulfilled'
          ? results[1].value
          : {};
        var localMemes = results[2].status === 'fulfilled' ? results[2].value : [];

        localTagCache = loadLocalTagCache();

        // Build the Imgflip memes immediately with whatever tags are already
        // cached; collect any with no cached tags for background cloud tagging.
        var missing = [];
        var shouldRefreshFromWorker = cloudTaggingEnabled();
        var imgflipMemes = raws.map(function (raw) {
          var tags = getCachedTags(raw, fileTagMap, localTagCache);
          if (shouldRefreshFromWorker || tags === null) missing.push(raw);
          return buildImgflipMeme(raw, tags || []);
        });

        // Normal case: API memes first, then internal memes.
        // Fallback case: if the API fails, the internal templates still show.
        memes = imgflipMemes.concat(localMemes);

        fetched = true;
        fetching = false;

        if (!memes.length) {
          setStatus('Could not load any memes.');
          return;
        }

        if (!imgflipMemes.length && localMemes.length) {
          setStatus('Showing internal library because the online meme API could not load.');
        } else {
          setStatus('');
        }

        runSearch();
        if (onFetchedCallback) onFetchedCallback(memes.slice());

        // Background, cost-limited cloud tagging for the untagged memes.
        enqueueMissing(missing);
      });
  }

  // Imgflip templates: returns the raw [{ id, name, url, ... }] array. Rejects
  // on transport / shape errors so the fallback logic can fall back to internal.
  function fetchImgflipMemes() {
    return fetch(ENDPOINT)
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        if (!data || !data.success || !data.data || !data.data.memes) {
          throw new Error('Unexpected response shape');
        }
        return data.data.memes;
      });
  }

  // Committed curated tags: { "<id>": { name, tags: [...] }, ... }. Best-effort:
  // any failure resolves to an empty map so search falls back to name + cache.
  function fetchImgflipTags() {
    return fetch(IMGFLIP_TAGS_PATH)
      .then(function (response) {
        if (!response.ok) return {};
        return response.json();
      })
      .then(function (data) {
        return data && typeof data === 'object' ? data : {};
      })
      .catch(function () {
        return {};
      });
  }

  // Internal-library templates, normalized to the same shape as Imgflip memes.
  // Best-effort: any failure resolves to an empty list so it never blocks the
  // Imgflip results from rendering.
  function fetchLocalTemplates() {
    return fetch(TEMPLATES_PATH)
      .then(function (response) {
        if (!response.ok) return [];
        return response.json();
      })
      .then(function (data) {
        return (Array.isArray(data) ? data : []).map(toMeme);
      })
      .catch(function () {
        return [];
      });
  }

  // Read the localStorage tag cache (id -> string[]). Returns {} if the cache
  // is empty, malformed, or localStorage is unavailable (e.g. private mode).
  function loadLocalTagCache() {
    try {
      var raw = window.localStorage.getItem(LOCAL_TAG_CACHE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  // Persist the tag cache. Failures (quota, unavailable storage) are non-fatal —
  // tags simply won't survive to the next visit.
  function saveLocalTagCache(cache) {
    try {
      window.localStorage.setItem(LOCAL_TAG_CACHE_KEY, JSON.stringify(cache || {}));
    } catch (e) {
      /* ignore */
    }
  }

  // Resolve cached tags for one Imgflip template, in priority order:
  //   1. localStorage cache, 2. committed tag file when cloud tagging is disabled.
  // Returns the tag array, or null when nothing is cached (→ candidate for the
  // Worker).
  function getCachedTags(raw, fileTagMap, tagCache) {
    var cached = tagCache && tagCache[raw.id];
    if (Array.isArray(cached) && cached.length) {
      return cached;
    }
    var fileEntry = fileTagMap && fileTagMap[raw.id];
    if (fileEntry && Array.isArray(fileEntry.tags) && fileEntry.tags.length) {
      return fileEntry.tags;
    }
    return null;
  }

  // Normalize an Imgflip API record into the same shape internal templates use,
  // so the search index treats both sources uniformly. searchText combines the
  // lowercased name with the tag keywords; an empty tag list still yields
  // name-only matching, matching prior behavior for untagged templates.
  function buildImgflipMeme(raw, tags) {
    var list = Array.isArray(tags) ? tags : [];
    return {
      id: raw.id,
      name: raw.name,
      url: raw.url,
      source: 'imgflip',
      tags: list,
      searchText: (raw.name + ' ' + list.join(' ')).toLowerCase()
    };
  }

  // Convert an internal template record into the meme shape used for rendering.
  // searchText bundles the extra metadata so internal templates can be matched
  // by character, emotion, or tag — not just by name.
  function toMeme(t) {
    return {
      id: t.id,
      name: t.name,
      url: resolveImageUrl(t.image),
      source: 'internal',
      tags: Array.isArray(t.tags) ? t.tags : [],
      searchText: buildSearchText(t)
    };
  }

  function buildSearchText(t) {
    var parts = [t.name, t.character, t.emotion];
    if (Array.isArray(t.tags)) parts = parts.concat(t.tags);
    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  // encodeURI keeps "/" but escapes spaces and other unsafe characters so
  // filenames like "TAJ-weird smile.webp" resolve correctly.
  function resolveImageUrl(image) {
    return encodeURI(ASSET_PREFIX + image);
  }

  // ── Background cloud tagging ────────────────────────────────────────────────

  // Cloud tagging is only attempted once a real Worker URL is configured, so
  // local/static runs never call a dead endpoint.
  function resolveAiTagEndpoint(opts) {
    var configured = opts && opts.aiTagEndpoint;
    if (!configured && window.MemeGenConfig) {
      configured = window.MemeGenConfig.aiTagEndpoint;
    }
    return typeof configured === 'string' ? configured.trim() : '';
  }

  function cloudTaggingEnabled() {
    return /^https?:\/\//i.test(aiTagEndpoint);
  }

  // Queue up to MAX_CLOUD_TAGS untagged memes for slow background tagging.
  function enqueueMissing(missing) {
    if (!cloudTaggingEnabled() || !missing.length) return;
    tagQueue = missing.slice(0, MAX_CLOUD_TAGS);
    processTagQueue();
  }

  // Process the queue one meme at a time, spacing calls out. A single failure
  // never stops the others, and never disrupts the UI.
  function processTagQueue() {
    if (queueRunning) return;
    queueRunning = true;

    function next() {
      if (!tagQueue.length) {
        queueRunning = false;
        return;
      }
      var raw = tagQueue.shift();
      tagMemeThroughCloud(raw)
        .then(function (tags) {
          if (tags && tags.length) updateMemeTags(raw.id, tags);
        })
        .catch(function () {
          /* this meme stays searchable by name only */
        })
        .then(function () {
          setTimeout(next, CLOUD_TAG_DELAY_MS);
        });
    }

    next();
  }

  // Ask the Cloudflare Worker to AI-tag one template. Resolves with a cleaned
  // tag array; rejects on transport errors or an invalid response shape.
  function tagMemeThroughCloud(raw) {
    return fetch(aiTagEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: raw.id, name: raw.name, imageUrl: raw.url })
    })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.tags)) throw new Error('Bad tag response');
        return sanitizeTags(data.tags);
      });
  }

  // Defensive client-side cleanup of any tag list: lowercase, trimmed, short,
  // de-duplicated, capped. The Worker validates too, but we never trust input.
  function sanitizeTags(tags) {
    var seen = {};
    var out = [];
    for (var i = 0; i < tags.length && out.length < MAX_TAGS; i++) {
      if (typeof tags[i] !== 'string') continue;
      var v = tags[i].toLowerCase().trim();
      if (v && v.length <= 40 && !seen[v]) {
        seen[v] = true;
        out.push(v);
      }
    }
    return out;
  }

  // Apply freshly fetched tags to a cached meme: update its searchText, persist
  // to localStorage, and re-run the current search so it appears if it now
  // matches the query.
  function updateMemeTags(id, tags) {
    var clean = sanitizeTags(tags);
    for (var i = 0; i < memes.length; i++) {
      if (memes[i].id === id) {
        memes[i].tags = clean;
        memes[i].searchText = (memes[i].name + ' ' + clean.join(' ')).toLowerCase();
        break;
      }
    }
    localTagCache[id] = clean;
    saveLocalTagCache(localTagCache);
    runSearch();
  }

  // ── Search + render ─────────────────────────────────────────────────────────

  // Filter cached templates by the current query and render the grid.
  function runSearch() {
    if (!fetched) {
      ensureFetched();
      return;
    }
    var query = (inputEl.value || '').trim().toLowerCase();
    var queryTerms = getQueryTerms(query);
    var filtered = query
      ? memes.filter(function (m) {
          var haystack = m.searchText || (m.name || '').toLowerCase();
          return queryTerms.some(function (term) {
            return haystack.indexOf(term) !== -1;
          });
        })
      : memes;
    render(filtered);
  }

  function getQueryTerms(query) {
    var normalizedQuery = normalizeQuery(query);
    var baseTerms = [query];
    if (normalizedQuery && normalizedQuery !== query) baseTerms.push(normalizedQuery);
    if (PHRASE_QUERY_EXPANSIONS[normalizedQuery]) {
      baseTerms = baseTerms.concat(PHRASE_QUERY_EXPANSIONS[normalizedQuery]);
    }
    if (EMOTION_QUERY_EXPANSIONS[normalizedQuery]) {
      baseTerms = baseTerms.concat(EMOTION_QUERY_EXPANSIONS[normalizedQuery]);
    }
    normalizedQuery.split(' ').forEach(function (word) {
      if (!word || QUERY_FILLER_WORDS[word]) return;
      baseTerms.push(word);
      if (EMOTION_QUERY_EXPANSIONS[word]) {
        baseTerms = baseTerms.concat(EMOTION_QUERY_EXPANSIONS[word]);
      }
    });

    var terms = [];
    baseTerms.forEach(function (term) {
      terms.push(term);
      var inflections = EMOTION_INFLECTIONS[term];
      if (inflections) terms = terms.concat(inflections);
    });
    var seen = {};
    return terms.filter(function (term) {
      if (!term || seen[term]) return false;
      seen[term] = true;
      return true;
    });
  }

  function normalizeQuery(query) {
    return (query || '')
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Build the result cards. Each card is a button so it's keyboard accessible.
  function render(list) {
    resultsEl.innerHTML = '';

    if (!list.length) {
      setStatus('No memes match your search.');
      return;
    }
    setStatus('');

    list.forEach(function (meme) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'meme-search-card';
      card.title = meme.name;

      var img = document.createElement('img');
      img.src = meme.url;
      img.alt = meme.name;
      img.loading = 'lazy';
      // Anonymous CORS so the image can be drawn to canvas without tainting.
      img.crossOrigin = 'anonymous';

      card.appendChild(img);

      card.addEventListener('click', function () {
        if (onSelectCallback) onSelectCallback(meme);
        scrollPageToTop();
      });

      resultsEl.appendChild(card);
    });
  }

  function scrollPageToTop() {
    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  }

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  // Load a remote meme image onto the canvas via the existing ImageLoader.
  //
  // We fetch the image URL as a Blob and then hand it to ImageLoader.loadFromFile
  // (which internally uses FileReader.readAsDataURL — that accepts any Blob,
  // not just File objects). This avoids adding a URL-loading code path to
  // ImageLoader and reuses its existing canvas-sizing and callback logic.
  //
  // Using fetch (rather than setting <img>.src directly) means the request
  // goes through CORS and the resulting data URL is same-origin to the page,
  // so the canvas is not tainted and the download flow keeps working.
  function loadFromUrl(url, onError) {
    fetch(url, { mode: 'cors' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.blob();
      })
      .then(function (blob) {
        MemeGen.ImageLoader.loadFromFile(blob);
      })
      .catch(function (err) {
        if (typeof onError === 'function') onError(err);
      });
  }

  return {
    init: init,
    loadFromUrl: loadFromUrl,
    getAll: function () { return memes.slice(); }
  };
})();

window.MemeGen = MemeGen;

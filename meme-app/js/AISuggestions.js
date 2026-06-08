/**
 * AISuggestions — controller + view for the "Get AI Suggestions" feature.
 *
 * Lets the user describe who they are and the situation they want to express,
 * then asks Gemini for 3 meme template suggestions with captions. Clicking a
 * suggestion fires the onSelect callback with the full template object plus
 * the chosen captions, so app.js can load the template and pre-populate the
 * text boxes.
 *
 * Mirrors the MemeSearch.js module shape (init opts + onSelect callback).
 *
 * Template source: the ImgFlip public meme library (same endpoint as
 * MemeSearch). ImgFlip's ~100 popular templates are well-known to Gemini
 * culturally, so their `name` alone is enough for the model to make good
 * picks — no character/emotion/tags metadata required.
 *
 * Public API:
 *   init(opts) — wires up DOM listeners. Required opts:
 *     root, getBtn, form, identity, situation, generateBtn,
 *     keyForm, keyInput, keySaveBtn, changeKeyLink,
 *     status, results, onSelect(template, captions)
 *
 * Exposes window.MemeGen.AISuggestions = { init }.
 */
var MemeGen = window.MemeGen || {};

MemeGen.AISuggestions = (function () {
  var IMGFLIP_ENDPOINT = 'https://api.imgflip.com/get_memes';

  // Cached meme list from ImgFlip; fetched on first Generate click.
  var memes = [];
  var memesPromise = null;

  function fetchMemes() {
    if (memesPromise) return memesPromise;
    memesPromise = fetch(IMGFLIP_ENDPOINT)
      .then(function (res) {
        if (!res.ok) throw new Error('ImgFlip HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.success || !data.data || !Array.isArray(data.data.memes)) {
          throw new Error('Unexpected ImgFlip response shape');
        }
        memes = data.data.memes;
        return memes;
      })
      .catch(function (err) {
        // Reset so a later retry can try again.
        memesPromise = null;
        throw err;
      });
    return memesPromise;
  }

  // DOM refs (from init opts). opts.root is accepted but not retained — the
  // host (app.js) controls panel show/hide via the `hidden` attribute.
  var getBtn, formEl, identityEl, situationEl, generateBtn,
      keyFormEl, keyInputEl, keySaveBtn, changeKeyLink,
      statusEl, resultsEl;
  var onSelectCallback = null;
  // Optional callbacks the host can hook to drive a secondary UI surface
  // (e.g. the desktop meme library on app.js side). All three default to
  // null so existing callers that only supply `onSelect` stay unchanged.
  var onGenerateStartCallback = null;
  var onGeneratedCallback     = null;
  var onGenerateErrorCallback = null;

  // Set to true when a Generate click is blocked by a missing key; once the
  // key is saved we re-fire the generate flow automatically.
  var pendingGenerate = false;

  // ── Init / wiring ────────────────────────────────────────────────────────

  function init(opts) {
    getBtn        = opts.getBtn;
    formEl        = opts.form;
    identityEl    = opts.identity;
    situationEl   = opts.situation;
    generateBtn   = opts.generateBtn;
    keyFormEl     = opts.keyForm;
    keyInputEl    = opts.keyInput;
    keySaveBtn    = opts.keySaveBtn;
    changeKeyLink = opts.changeKeyLink;
    statusEl      = opts.status;
    resultsEl     = opts.results;
    onSelectCallback = opts.onSelect || null;
    onGenerateStartCallback = typeof opts.onGenerateStart === 'function' ? opts.onGenerateStart : null;
    onGeneratedCallback     = typeof opts.onGenerated     === 'function' ? opts.onGenerated     : null;
    onGenerateErrorCallback = typeof opts.onGenerateError === 'function' ? opts.onGenerateError : null;

    if (getBtn) {
      getBtn.addEventListener('click', onGetClick);
    } else if (formEl) {
      // No standalone reveal button — make the form visible immediately so
      // the consumer (e.g. a panel wrapped around it) controls show/hide.
      formEl.hidden = false;
    }
    if (generateBtn)   generateBtn.addEventListener('click', onGenerateClick);
    if (keySaveBtn)    keySaveBtn.addEventListener('click', onSaveKeyClick);
    if (changeKeyLink) changeKeyLink.addEventListener('click', onChangeKeyClick);

    // Show "Change API key" only when a key is already saved.
    refreshChangeKeyVisibility();
  }

  function refreshChangeKeyVisibility() {
    if (!changeKeyLink) return;
    if (MemeGen.GeminiClient && MemeGen.GeminiClient.hasApiKey()) {
      changeKeyLink.hidden = false;
    } else {
      changeKeyLink.hidden = true;
    }
  }

  function setStatus(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
  }

  // ── Event handlers ───────────────────────────────────────────────────────

  function onGetClick() {
    if (formEl)  formEl.hidden  = false;
    if (getBtn)  getBtn.hidden  = true;
    if (identityEl) identityEl.focus();
    setStatus('');
  }

  function onGenerateClick() {
    var identity  = identityEl ? identityEl.value.trim() : '';
    var situation = situationEl ? situationEl.value.trim() : '';

    if (!identity || !situation) {
      setStatus('Please fill in both fields.');
      return;
    }

    if (!MemeGen.GeminiClient || !MemeGen.GeminiClient.hasApiKey()) {
      pendingGenerate = true;
      showKeyForm();
      setStatus('Paste your Gemini API key below to continue.');
      return;
    }

    runGenerate(identity, situation);
  }

  function runGenerate(identity, situation) {
    setStatus('Loading templates…');
    if (resultsEl) resultsEl.innerHTML = '';
    if (generateBtn) generateBtn.disabled = true;
    // Let the host UI (e.g. desktop meme library) flip into its loading
    // state as soon as the request is dispatched.
    if (onGenerateStartCallback) onGenerateStartCallback();

    fetchMemes()
      .then(function (memeList) {
        setStatus('Thinking…');
        // ImgFlip returns ~100 templates; Gemini only needs the name to
        // recognize each one culturally. Trim to a reasonable size so the
        // prompt stays small (~100 lines is fine for gemini-2.5-flash).
        var templates = memeList.map(function (m) {
          return { id: m.id, name: m.name };
        });
        return MemeGen.GeminiClient.generateSuggestions(identity, situation, templates);
      })
      .then(function (suggestions) {
        renderSuggestions(suggestions);
        // Hand the host a normalized {id,name,url,captions}[] list so it
        // can mirror the cards in its own surface (no duplicate code).
        if (onGeneratedCallback) {
          var normalized = suggestions.map(function (s) {
            var meme = findMemeById(s.template_id);
            if (!meme) return null;
            return {
              id: meme.id,
              name: meme.name,
              url: meme.url,
              captions: s.captions || []
            };
          }).filter(Boolean);
          onGeneratedCallback(normalized);
        }
      })
      .catch(handleError)
      .then(function () {
        if (generateBtn) generateBtn.disabled = false;
      });
  }

  function onSaveKeyClick() {
    var key = keyInputEl ? keyInputEl.value : '';
    if (!key || !key.trim()) {
      setStatus('Please paste a key first.');
      return;
    }
    MemeGen.GeminiClient.setApiKey(key);
    hideKeyForm();
    refreshChangeKeyVisibility();
    setStatus('');

    if (pendingGenerate) {
      pendingGenerate = false;
      var identity  = identityEl ? identityEl.value.trim() : '';
      var situation = situationEl ? situationEl.value.trim() : '';
      if (identity && situation) {
        runGenerate(identity, situation);
      }
    }
  }

  function onChangeKeyClick(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (keyInputEl) keyInputEl.value = MemeGen.GeminiClient.getApiKey() || '';
    showKeyForm();
  }

  function showKeyForm() {
    if (keyFormEl)  keyFormEl.hidden  = false;
    if (keyInputEl) keyInputEl.focus();
  }

  function hideKeyForm() {
    if (keyFormEl) keyFormEl.hidden = true;
    if (keyInputEl) keyInputEl.value = '';
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  function findMemeById(id) {
    for (var i = 0; i < memes.length; i++) {
      if (memes[i].id === id) return memes[i];
    }
    return null;
  }

  function renderSuggestions(suggestions) {
    if (!resultsEl) return;
    resultsEl.innerHTML = '';
    setStatus(suggestions.length + ' suggestion' + (suggestions.length === 1 ? '' : 's') + ' — click one to load.');

    suggestions.forEach(function (s) {
      var meme = findMemeById(s.template_id);
      if (!meme) return;
      // Normalize to the {id, name, url} shape the rest of the code expects.
      var template = { id: meme.id, name: meme.name, url: meme.url };
      resultsEl.appendChild(buildCard(template, s.captions));
    });
  }

  function buildCard(template, captions) {
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'ai-result-card';
    card.setAttribute('data-template-id', template.id);
    card.setAttribute(
      'aria-label',
      'Use ' + template.name + ' template with caption "' +
      (captions[0] || '') + '" and "' + (captions[1] || '') + '"'
    );

    var previewWrap = document.createElement('div');
    previewWrap.className = 'ai-preview-wrap';

    var img = document.createElement('img');
    img.src = template.url;
    img.alt = template.name;
    img.loading = 'lazy';
    // Anonymous CORS so the same image can be drawn to canvas later
    // without tainting it (mirrors the MemeSearch card pattern).
    img.crossOrigin = 'anonymous';
    previewWrap.appendChild(img);

    var safeCaptions = Array.isArray(captions) ? captions : [];
    safeCaptions.slice(0, 3).forEach(function (caption, index) {
      var captionEl = document.createElement('span');
      var posClass = 'ai-preview-caption-middle';
      if (index === 0) posClass = 'ai-preview-caption-top';
      if (index === safeCaptions.length - 1 && index > 0) posClass = 'ai-preview-caption-bottom';
      captionEl.className = 'ai-preview-caption ' + posClass;
      captionEl.textContent = caption;
      previewWrap.appendChild(captionEl);
    });

    card.appendChild(previewWrap);

    var name = document.createElement('span');
    name.className = 'ai-result-name';
    name.textContent = template.name;
    card.appendChild(name);

    // Keep caption list for screen readers; visually hidden.
    var capList = document.createElement('ul');
    capList.className = 'ai-caption-list visually-hidden';
    safeCaptions.forEach(function (cap) {
      var li = document.createElement('li');
      li.textContent = cap;
      capList.appendChild(li);
    });
    card.appendChild(capList);

    card.addEventListener('click', function () {
      if (onSelectCallback) onSelectCallback(template, captions);
    });

    return card;
  }

  // ── Error handling ────────────────────────────────────────────────────────

  function handleError(err) {
    if (!MemeGen.GeminiClient) {
      setStatus('Gemini client is not loaded.');
      // Notify the host so it can surface the error in its secondary UI
      // (e.g. desktop meme library). KeyError below is recoverable — we
      // resume the same generate flow once the key is saved — so it
      // intentionally does NOT fire onGenerateError.
      if (onGenerateErrorCallback) onGenerateErrorCallback(err);
      return;
    }
    var GC = MemeGen.GeminiClient;
    if (err instanceof GC.KeyError) {
      pendingGenerate = true;
      showKeyForm();
      setStatus('Please enter your Gemini API key.');
      return;
    }
    if (err instanceof GC.APIError) {
      if (err.status === 429) {
        setStatus('Rate limited — try again in a moment.');
      } else if (err.status === 400 || err.status === 401 || err.status === 403) {
        setStatus('Gemini rejected the request (HTTP ' + err.status + '). The API key may be invalid.');
      } else {
        setStatus('Gemini error (HTTP ' + err.status + '). Try again.');
      }
      if (onGenerateErrorCallback) onGenerateErrorCallback(err);
      return;
    }
    if (err instanceof GC.NetworkError) {
      setStatus('Could not reach Gemini. Check your connection.');
      if (onGenerateErrorCallback) onGenerateErrorCallback(err);
      return;
    }
    if (err instanceof GC.ParseError) {
      setStatus('Gemini returned an unexpected response. Try again.');
      if (onGenerateErrorCallback) onGenerateErrorCallback(err);
      return;
    }
    setStatus('Something went wrong: ' + (err && err.message ? err.message : 'unknown error'));
    if (onGenerateErrorCallback) onGenerateErrorCallback(err);
  }

  return {
    init: init,
    // Exposed for tests.
    _fetchMemes: fetchMemes,
    _setMemesForTest: function (list) { memes = list; memesPromise = Promise.resolve(list); }
  };
})();

window.MemeGen = MemeGen;

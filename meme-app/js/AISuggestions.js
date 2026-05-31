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
 * Note on templates: templates.json does NOT exist on v4 yet (PR #35 not
 * merged), so we ship the manifest inline. URLs point to existing files
 * under ../assets/templates/ — three filenames carry typos preserved from
 * the originals (sponebob-, supprise, teasewebp, "weird smile") so the urls
 * exactly match the on-disk files; ids are kebab-case and decoupled from
 * the filenames so they read cleanly in the prompt.
 *
 * Public API:
 *   init(opts) — wires up DOM listeners. Required opts:
 *     root, getBtn, form, identity, situation, generateBtn,
 *     keyForm, keyInput, keySaveBtn, changeKeyLink,
 *     status, results, onSelect(template, captions)
 *
 * Exposes window.MemeGen.AISuggestions = { init, TEMPLATES }.
 */
var MemeGen = window.MemeGen || {};

MemeGen.AISuggestions = (function () {
  var ASSET_PREFIX = '../assets/templates/';

  // Inline templates manifest. Each entry: id (stable, kebab-case, sent to
  // Gemini), name (human label), character, emotion, tags, url (literal path).
  var TEMPLATES = [
    // SpongeBob
    { id: 'spongebob-excited',  name: 'SpongeBob Excited',  character: 'SpongeBob', emotion: 'excited',  tags: ['cartoon', 'happy', 'enthusiastic'], url: ASSET_PREFIX + 'spongebob-meme-templates/sponebob-excited.jpg' },
    { id: 'spongebob-dead',     name: 'SpongeBob Dead',     character: 'SpongeBob', emotion: 'dead',     tags: ['cartoon', 'tired', 'exhausted'],    url: ASSET_PREFIX + 'spongebob-meme-templates/spongebob-dead.jpg' },
    { id: 'spongebob-mocking',  name: 'SpongeBob Mocking',  character: 'SpongeBob', emotion: 'mocking',  tags: ['cartoon', 'sarcastic', 'mocking'],  url: ASSET_PREFIX + 'spongebob-meme-templates/spongebob-mocking.jpg' },
    { id: 'spongebob-relieved', name: 'SpongeBob Relieved', character: 'SpongeBob', emotion: 'relieved', tags: ['cartoon', 'happy', 'relieved'],     url: ASSET_PREFIX + 'spongebob-meme-templates/spongebob-relieved.jpg' },
    { id: 'spongebob-sad',      name: 'SpongeBob Sad',      character: 'SpongeBob', emotion: 'sad',      tags: ['cartoon', 'sad', 'crying'],         url: ASSET_PREFIX + 'spongebob-meme-templates/spongebob-sad.jpg' },

    // LeBron
    { id: 'lebron-funny',    name: 'LeBron Funny',     character: 'LeBron', emotion: 'funny',    tags: ['sports', 'basketball', 'funny'],     url: ASSET_PREFIX + 'lebron-meme-templates/lebron-funny.jpg' },
    { id: 'lebron-happy',    name: 'LeBron Happy',     character: 'LeBron', emotion: 'happy',    tags: ['sports', 'basketball', 'happy'],     url: ASSET_PREFIX + 'lebron-meme-templates/lebron-happy.jpg' },
    { id: 'lebron-locked',   name: 'LeBron Locked In', character: 'LeBron', emotion: 'locked-in', tags: ['sports', 'basketball', 'focused'], url: ASSET_PREFIX + 'lebron-meme-templates/lebron-locked.jpg' },
    { id: 'lebron-sad',      name: 'LeBron Sad',       character: 'LeBron', emotion: 'sad',      tags: ['sports', 'basketball', 'sad'],       url: ASSET_PREFIX + 'lebron-meme-templates/lebron-sad.jpg' },
    { id: 'lebron-shocked',  name: 'LeBron Shocked',   character: 'LeBron', emotion: 'shocked',  tags: ['sports', 'basketball', 'shocked'],   url: ASSET_PREFIX + 'lebron-meme-templates/lebron-shocked.jpg' },
    { id: 'lebron-sunshine', name: 'LeBron Sunshine',  character: 'LeBron', emotion: 'cheerful', tags: ['sports', 'basketball', 'cheerful'],  url: ASSET_PREFIX + 'lebron-meme-templates/lebron-sunshine.jpg' },

    // TAJ (typos in filenames preserved)
    { id: 'taj-crazy',       name: 'TAJ Crazy',       character: 'TAJ', emotion: 'crazy',       tags: ['pop-culture', 'crazy', 'wild'],      url: ASSET_PREFIX + 'TAJ-meme-templates/TAJ-crazy.png' },
    { id: 'taj-easy',        name: 'TAJ Easy',        character: 'TAJ', emotion: 'easy',        tags: ['pop-culture', 'chill', 'relaxed'],   url: ASSET_PREFIX + 'TAJ-meme-templates/TAJ-easy.png' },
    { id: 'taj-mad',         name: 'TAJ Mad',         character: 'TAJ', emotion: 'mad',         tags: ['pop-culture', 'angry', 'mad'],       url: ASSET_PREFIX + 'TAJ-meme-templates/TAJ-mad.webp' },
    { id: 'taj-serious',     name: 'TAJ Serious',     character: 'TAJ', emotion: 'serious',     tags: ['pop-culture', 'serious'],            url: ASSET_PREFIX + 'TAJ-meme-templates/TAJ-serious.png' },
    { id: 'taj-sorry',       name: 'TAJ Sorry',       character: 'TAJ', emotion: 'sorry',       tags: ['pop-culture', 'apologetic'],         url: ASSET_PREFIX + 'TAJ-meme-templates/TAJ-sorry.webp' },
    { id: 'taj-surprise',    name: 'TAJ Surprised',   character: 'TAJ', emotion: 'surprised',   tags: ['pop-culture', 'surprised'],          url: ASSET_PREFIX + 'TAJ-meme-templates/TAJ-supprise.png' },
    { id: 'taj-tease',       name: 'TAJ Tease',       character: 'TAJ', emotion: 'teasing',     tags: ['pop-culture', 'playful', 'teasing'], url: ASSET_PREFIX + 'TAJ-meme-templates/TAJ-teasewebp.webp' },
    { id: 'taj-weird-smile', name: 'TAJ Weird Smile', character: 'TAJ', emotion: 'awkward',     tags: ['pop-culture', 'awkward'],            url: encodeURI(ASSET_PREFIX + 'TAJ-meme-templates/TAJ-weird smile.webp') }
  ];

  // DOM refs (from init opts)
  var rootEl, getBtn, formEl, identityEl, situationEl, generateBtn,
      keyFormEl, keyInputEl, keySaveBtn, changeKeyLink,
      statusEl, resultsEl;
  var onSelectCallback = null;

  // Set to true when a Generate click is blocked by a missing key; once the
  // key is saved we re-fire the generate flow automatically.
  var pendingGenerate = false;

  // ── Init / wiring ────────────────────────────────────────────────────────

  function init(opts) {
    rootEl        = opts.root;
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
    setStatus('Thinking…');
    if (resultsEl) resultsEl.innerHTML = '';
    if (generateBtn) generateBtn.disabled = true;

    MemeGen.GeminiClient.generateSuggestions(identity, situation, TEMPLATES)
      .then(renderSuggestions)
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

  function findTemplateById(id) {
    for (var i = 0; i < TEMPLATES.length; i++) {
      if (TEMPLATES[i].id === id) return TEMPLATES[i];
    }
    return null;
  }

  function renderSuggestions(suggestions) {
    if (!resultsEl) return;
    resultsEl.innerHTML = '';
    setStatus(suggestions.length + ' suggestion' + (suggestions.length === 1 ? '' : 's') + ' — click one to load.');

    suggestions.forEach(function (s) {
      var template = findTemplateById(s.template_id);
      if (!template) return;
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

    var img = document.createElement('img');
    img.src = template.url;
    img.alt = template.name;
    img.loading = 'lazy';
    card.appendChild(img);

    var name = document.createElement('span');
    name.className = 'ai-result-name';
    name.textContent = template.name;
    card.appendChild(name);

    var capList = document.createElement('ul');
    capList.className = 'ai-caption-list';
    captions.forEach(function (cap) {
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
      return;
    }
    if (err instanceof GC.NetworkError) {
      setStatus('Could not reach Gemini. Check your connection.');
      return;
    }
    if (err instanceof GC.ParseError) {
      setStatus('Gemini returned an unexpected response. Try again.');
      return;
    }
    setStatus('Something went wrong: ' + (err && err.message ? err.message : 'unknown error'));
  }

  return {
    init: init,
    TEMPLATES: TEMPLATES
  };
})();

window.MemeGen = MemeGen;

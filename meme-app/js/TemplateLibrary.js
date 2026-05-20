var MemeGen = window.MemeGen || {};

MemeGen.TemplateLibrary = (function () {
  // index.html lives in meme-app/, templates.json + images live in the
  // sibling assets/ folder, so paths declared in the JSON (which are repo-root
  // relative) need a leading "../" when loaded from the page.
  var TEMPLATES_PATH = '../assets/templates/templates.json';
  var ASSET_PREFIX = '../';

  var CATEGORY_LABELS = {
    'all': 'All Categories',
    'sports': 'Sports memes',
    'animation': 'Animation memes',
    'animals': 'Animal memes',
    'pop-culture': 'Pop Culture memes'
  };
  var CATEGORY_ORDER = ['all', 'sports', 'animation', 'animals', 'pop-culture'];

  var templates = [];
  var gridEl = null;
  var searchEl = null;
  var categoryEl = null;
  var statusEl = null;
  var onSelect = null;

  function init(opts) {
    gridEl = opts.gridEl;
    searchEl = opts.searchEl;
    categoryEl = opts.categoryEl;
    statusEl = opts.statusEl;
    onSelect = opts.onSelect;

    populateCategoryOptions();

    searchEl.addEventListener('input', render);
    categoryEl.addEventListener('change', render);

    fetch(TEMPLATES_PATH)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        templates = Array.isArray(data) ? data : [];
        setStatus('');
        render();
      })
      .catch(function (err) {
        console.error('Failed to load templates.json', err);
        setStatus('Could not load template library. Serve the app from a local web server and try again.');
      });
  }

  function populateCategoryOptions() {
    CATEGORY_ORDER.forEach(function (key) {
      var opt = document.createElement('option');
      opt.value = key;
      opt.textContent = CATEGORY_LABELS[key];
      categoryEl.appendChild(opt);
    });
  }

  function setStatus(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.hidden = !msg;
  }

  function matchesQuery(t, query) {
    if (!query) return true;
    var q = query.toLowerCase();
    var fields = [t.name, t.character, t.emotion];
    for (var i = 0; i < fields.length; i++) {
      if (fields[i] && String(fields[i]).toLowerCase().indexOf(q) !== -1) return true;
    }
    if (Array.isArray(t.tags)) {
      for (var j = 0; j < t.tags.length; j++) {
        if (String(t.tags[j]).toLowerCase().indexOf(q) !== -1) return true;
      }
    }
    return false;
  }

  function render() {
    if (!gridEl) return;
    var query = searchEl.value.trim();
    var category = categoryEl.value;

    var filtered = templates.filter(function (t) {
      var catOk = category === 'all' || t.category === category;
      return catOk && matchesQuery(t, query);
    });

    gridEl.innerHTML = '';

    if (!filtered.length) {
      setStatus(templates.length ? 'No templates match your search.' : '');
      return;
    }
    setStatus('');

    filtered.forEach(function (t) {
      gridEl.appendChild(buildCard(t));
    });
  }

  function buildAriaLabel(t) {
    var parts = ['Use ' + t.name + ' template'];
    if (t.emotion) parts.push('emotion ' + t.emotion);
    if (t.category) parts.push('category ' + t.category);
    return parts.join(', ');
  }

  function resolveImageUrl(image) {
    // encodeURI keeps "/" but escapes spaces and other unsafe characters so
    // filenames like "TAJ-weird smile.webp" resolve correctly.
    return encodeURI(ASSET_PREFIX + image);
  }

  function buildCard(t) {
    var card = document.createElement('div');
    card.className = 'template-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('data-template-id', t.id);
    card.setAttribute('aria-label', buildAriaLabel(t));

    var img = document.createElement('img');
    img.src = resolveImageUrl(t.image);
    img.alt = t.name;
    img.loading = 'lazy';
    card.appendChild(img);

    function activate() {
      if (onSelect) onSelect(resolveImageUrl(t.image), t);
    }
    card.addEventListener('click', activate);
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate();
      }
    });

    return card;
  }

  return {
    init: init
  };
})();

window.MemeGen = MemeGen;

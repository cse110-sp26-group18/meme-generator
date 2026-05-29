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
 */
MemeGen.MemeSearch = (function () {
  var ENDPOINT = 'https://api.imgflip.com/get_memes';

  // index.html lives in meme-app/, while templates.json + its images live in
  // the sibling assets/ folder, so the repo-root-relative paths in the JSON
  // need a leading "../" when loaded from the page.
  var TEMPLATES_PATH = '../assets/templates/templates.json';
  var ASSET_PREFIX = '../';

  // Cached templates and fetch state.
  var memes = [];
  var fetched = false;
  var fetching = false;

  // DOM references and callback set during init().
  var inputEl = null;
  var resultsEl = null;
  var statusEl = null;
  var onSelectCallback = null;

  /**
   * Wire up the search UI.
   *  opts.input    — text input element
   *  opts.results  — container element that will hold the result cards
   *  opts.status   — element used for loading / empty / error messages
   *  opts.onSelect — function(meme) called when a result card is clicked
   */
  function init(opts) {
    inputEl = opts.input;
    resultsEl = opts.results;
    statusEl = opts.status;
    onSelectCallback = opts.onSelect || null;

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

  // Fetch the Imgflip list and the internal library once, merge, and cache.
  // Imgflip is the primary source: if it fails we surface an error. The local
  // library is best-effort — if it can't be loaded we just omit it.
  function ensureFetched() {
    if (fetched || fetching) return;
    fetching = true;
    setStatus('Loading memes…');

    Promise.all([fetchImgflipMemes(), fetchLocalTemplates()])
      .then(function (lists) {
        // Imgflip's popular memes first, then the internal library after them.
        memes = lists[0].concat(lists[1]);
        fetched = true;
        fetching = false;
        setStatus('');
        runSearch();
      })
      .catch(function (err) {
        fetching = false;
        setStatus('Could not load memes: ' + err.message);
      });
  }

  // Imgflip templates: { id, name, url, ... } as returned by the endpoint.
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

  // Convert an internal template record into the meme shape used for rendering.
  // searchText bundles the extra metadata so internal templates can be matched
  // by character, emotion, or tag — not just by name.
  function toMeme(t) {
    return {
      id: t.id,
      name: t.name,
      url: resolveImageUrl(t.image),
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

  // Filter cached templates by the current query and render the grid.
  function runSearch() {
    if (!fetched) {
      ensureFetched();
      return;
    }
    var query = (inputEl.value || '').trim().toLowerCase();
    var filtered = query
      ? memes.filter(function (m) {
          var haystack = m.searchText || (m.name || '').toLowerCase();
          return haystack.indexOf(query) !== -1;
        })
      : memes;
    render(filtered);
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

      var label = document.createElement('span');
      label.className = 'meme-search-name';
      label.textContent = meme.name;

      card.appendChild(img);
      card.appendChild(label);
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
    loadFromUrl: loadFromUrl
  };
})();

window.MemeGen = MemeGen;

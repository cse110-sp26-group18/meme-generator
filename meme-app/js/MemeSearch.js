var MemeGen = window.MemeGen || {};

/**
 * MemeSearch
 *
 * Fetches popular meme templates from Imgflip's public `get_memes` endpoint
 * (no API key required for read-only access) and lets the user filter them
 * by name. Selecting a result invokes the onSelect callback with the chosen
 * template, so the host app can load the image onto the canvas.
 *
 * The endpoint returns ~100 templates, so all filtering is done client-side
 * against the cached list — no per-keystroke network calls.
 */
MemeGen.MemeSearch = (function () {
  var ENDPOINT = 'https://api.imgflip.com/get_memes';

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
   * @param {Object} opts - configuration object containing: input
   *   (HTMLInputElement) for search queries, results (HTMLElement) for
   *   rendered cards, status (HTMLElement) for loading/error messages,
   *   and onSelect (function) called with the chosen meme template object
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

  /**
   * Fetches the meme template list from the API if not already fetched or
   *   in progress. Results are cached in `memes` for all subsequent searches.
   */
  function ensureFetched() {
    if (fetched || fetching) return;
    fetching = true;
    setStatus('Loading memes…');

    fetch(ENDPOINT)
      .then(function (response) {
        // fetch() only rejects on network failure; response.ok is false for
        // HTTP error codes (4xx/5xx), so we convert those to thrown errors.
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        if (!data || !data.success || !data.data || !data.data.memes) {
          throw new Error('Unexpected response shape');
        }
        memes = data.data.memes;
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

  /**
   * Filters the cached template list by the current input value and renders
   *   the matching results. Triggers a fetch first if templates are not yet loaded.
   */
  function runSearch() {
    if (!fetched) {
      ensureFetched();
      return;
    }
    var query = (inputEl.value || '').trim().toLowerCase();
    var filtered = query
      ? memes.filter(function (m) {
          return m.name.toLowerCase().indexOf(query) !== -1;
        })
      : memes;
    render(filtered);
  }

  /**
   * Clears and rebuilds the results grid from a filtered list of templates.
   *   Each card is a button for keyboard accessibility.
   * @param {Object[]} list - meme template objects from the Imgflip API,
   *   each with `name` and `url` string properties
   */
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
      // lazy loading defers fetching off-screen images until they near the
      // viewport, reducing bandwidth on initial render of the full meme grid.
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

  /**
   * Smoothly scrolls the page to the top so the canvas is visible after
   *   a meme template is selected from the results grid.
   */
  function scrollPageToTop() {
    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  }

  /**
   * @param {string} msg - message to display in the status element; pass an
   *   empty string to clear any existing message
   */
  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  /**
   * Fetches a remote image by URL and loads it onto the canvas via
   *   ImageLoader.loadFromFile. Fetching as a Blob (rather than setting
   *   img.src directly) keeps the canvas untainted for PNG export, since
   *   the resulting data URL is same-origin to the page.
   * @param {string} url - URL of the meme image to fetch and load
   * @param {function(Error)} onError - called with the Error if the network
   *   request or image load fails
   */
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

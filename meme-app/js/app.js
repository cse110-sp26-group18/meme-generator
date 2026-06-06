// DOMContentLoaded fires once the HTML is parsed but before images and
// stylesheets finish loading — all DOM elements queried below are available.
document.addEventListener('DOMContentLoaded', function () {
  var canvas = document.getElementById('meme-canvas');
  var container = document.getElementById('canvas-container');
  var imageInput = document.getElementById('image-input');
  var downloadBtn = document.getElementById('download-btn');
  var shareBtn = document.getElementById('share-btn');
  var searchIconBtn = document.getElementById('search-icon-btn');
  var memeSearchSection = document.getElementById('meme-search');
  var memeSearchCloseBtn = document.getElementById('meme-search-close');
  var mobileBackBtn = document.getElementById('mobile-back-btn');
  var mobileHomeBackBtn = document.getElementById('mobile-home-back-btn');
  var mobileHomePlusBtn = document.getElementById('mobile-home-plus-btn');
  var browseMemesBtn = document.getElementById('browse-memes-btn');
  var fontSettingsBtn = document.getElementById('font-settings-btn');
  var fontSettingsMenu = document.getElementById('font-settings-menu');
  var aiPandaBtn = document.getElementById('ai-panda-btn');
  var placeholder = document.getElementById('placeholder');
  var hint = document.getElementById('hint');

  // ── Mobile editor-first homepage / browse overlay (Screen 13) ──
  // Mobile boots into the editor. Tapping Browse Memes adds
  // body.browse-open which the @media (max-width: 768px) CSS uses to
  // reveal the dark forest search/template grid as a fullscreen overlay.
  // Selecting a meme (or uploading) removes the class — back to editor.
  // Desktop ignores the class entirely; both panels stay inline there.
  function showBrowseView() {
    document.body.classList.add('browse-open');
    // Show the back button only when there is a loaded image to return to.
    // On first reload no image exists yet so the back button stays hidden.
    if (mobileHomeBackBtn) {
      mobileHomeBackBtn.hidden = !container.classList.contains('has-image');
    }
  }
  function showEditorView() {
    document.body.classList.remove('browse-open');
  }

  MemeGen.ImageLoader.init(canvas, function (width, height) {
    container.style.removeProperty('width');
    container.style.removeProperty('height');

    container.style.setProperty('--canvas-aspect-ratio', width + ' / ' + height);
    container.style.setProperty('--canvas-ratio-num', (width / height).toFixed(4));
    container.classList.add('has-image');
    placeholder.hidden = true;
    hint.hidden = false;
    downloadBtn.disabled = false;
    shareBtn.disabled = false;
    // Scan Text stays disabled in this version — see the inert button
    // contract below. Do NOT enable it when an image loads.
    MemeGen.TextBoxManager.setImageLoaded(true);
    // Clear any "Loading…" message left over from the meme-search flow.
    var s = document.getElementById('meme-search-status');
    if (s) s.textContent = '';
    // Clear "Loading…" text on whichever AI panel set it (panels are split
    // into separate desktop/mobile IDs since the AI panel rework).
    ['desktop-ai-status', 'mobile-ai-status'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && /^Loading /.test(el.textContent)) el.textContent = '';
    });

    // Close the legacy slide-up overlay variant if it was left open.
    if (memeSearchSection) {
      memeSearchSection.classList.remove('is-open');
      if (searchIconBtn) searchIconBtn.setAttribute('aria-expanded', 'false');
    }
    // After a successful upload OR meme-template fetch, return to the
    // editor view. (Meme-search's onSelect also calls showEditorView
    // up-front so the user sees the "Loading…" state against the editor;
    // calling again here is idempotent and covers the plain upload path.)
    showEditorView();

    // If an AI suggestion is pending its captions, populate text boxes now
    // that the canvas is sized. Deferred one tick so layout fully commits.
    if (MemeGen.pendingAICaptions && Array.isArray(MemeGen.pendingAICaptions)) {
      var caps = MemeGen.pendingAICaptions;
      MemeGen.pendingAICaptions = null;
      setTimeout(function () { populatePresetCaptions(container, caps); }, 0);
    }
  });

  MemeGen.TextBoxManager.init(container, canvas);

  // ── Responsive text-box anchoring ──
  // CSS controls the canvas-container display size (mobile 60vh / desktop
  // 72vh / library-resize-driven width). When that size changes, the
  // ResizeObserver below asks TextBoxManager to re-apply each text box's
  // stored image-relative ratios, so the boxes stay anchored to the same
  // visual point on the meme instead of drifting with the pixel grid.
  // Guarded on ResizeObserver existence — older browsers degrade to the
  // pre-existing pixel-positioning behavior.
  if (typeof ResizeObserver === 'function' && container &&
      typeof MemeGen.TextBoxManager.syncTextBoxesToCanvas === 'function') {
    const ro = new ResizeObserver(function () {
      MemeGen.TextBoxManager.syncTextBoxesToCanvas();
    });
    ro.observe(container);
  }

  MemeGen.LayoutManager.init('panel-resizer', 'meme-search');

  // Show share button on mobile/tablet only; keep it hidden on desktop.
  // Mirror: hide #download-btn on mobile so the top action row is just
  // Upload + Share, matching the polished mobile mockup (Screen 1).
  if (MemeGen.Exporter.isMobileOrTablet()) {
   
    // Mobile boots into the Browse Memes overlay so the first thing a user
    // sees on reload is the meme template grid (per the flow correction).
    // Desktop stays on the editor — its inline layout shows everything.
    showBrowseView();
  }

  imageInput.addEventListener('change', function () {
    if (this.files && this.files[0]) {
      MemeGen.ImageLoader.loadFromFile(this.files[0]);
    }
  });

  /**
   * Scans a FileList and returns the first file whose MIME type starts with
   *   "image/" — used to safely pick the image from a mixed drag-and-drop.
   * @param {FileList|null} fileList - list of files from a drop event
   * @returns {File|null} the first image file found, or null if none present
   */
  function firstImageFile(fileList) {
    if (!fileList) return null;
    for (var i = 0; i < fileList.length; i++) {
      if (fileList[i].type && fileList[i].type.indexOf('image/') === 0) {
        return fileList[i];
      }
    }
    return null;
  }

  ['dragenter', 'dragover'].forEach(function (evt) {
    container.addEventListener(evt, function (e) {
      // preventDefault on dragover is required for the drop event to fire;
      // without it the browser cancels the drag and drop never triggers.
      e.preventDefault();
      e.stopPropagation();
      // dropEffect visually signals to the user that dropping will copy content
      // (shows a + cursor on most platforms).
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      container.classList.add('drag-over');
    });
  });

  ['dragleave', 'dragend'].forEach(function (evt) {
    container.addEventListener(evt, function (e) {
      e.preventDefault();
      e.stopPropagation();
      // relatedTarget is the element the pointer moved to; if it is still
      // inside the container the dragleave crossed a child element — ignore it
      // so the drag-over highlight doesn't flicker on child boundaries.
      if (evt === 'dragleave' && container.contains(e.relatedTarget)) return;
      container.classList.remove('drag-over');
    });
  });

  container.addEventListener('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    container.classList.remove('drag-over');
    var file = firstImageFile(e.dataTransfer && e.dataTransfer.files);
    if (file) {
      MemeGen.ImageLoader.loadFromFile(file);
    }
  });

  // Click the empty canvas region to open the file picker. Once an image
  // is loaded, clicks inside the canvas are reserved for adding text boxes,
  // so we gate on .has-image to avoid hijacking that interaction.
  container.addEventListener('click', function (e) {
  if (container.classList.contains('has-image')) return;

  // Do not open the file picker when clicking inside overlay UI such as
  // the AI suggestions panel.
  if (e.target.closest('#desktop-ai-suggestions-panel, #mobile-ai-suggestions-panel')) return;

  // Only the empty canvas area/placeholder should open the file picker.
  if (
    e.target === container ||
    e.target === canvas ||
    e.target === placeholder ||
    e.target.classList.contains('canvas-frame')
  ) {
    imageInput.click();
  }
});

  // Block the browser from opening the file if the drop misses the container.
  ['dragover', 'drop'].forEach(function (evt) {
    window.addEventListener(evt, function (e) {
      if (!container.contains(e.target)) e.preventDefault();
    });
  });

  downloadBtn.addEventListener('click', function () {
    var image = MemeGen.ImageLoader.getImage();
    var ctx = MemeGen.ImageLoader.getContext();
    var textBoxes = MemeGen.TextBoxManager.getAll();

    MemeGen.TextBoxManager.getAll().forEach(function (tb) {
      tb.deselect();
    });

    MemeGen.Exporter.exportMeme(canvas, ctx, image, textBoxes, function () {
      MemeGen.ImageLoader.redraw();
    });
  });

  // Share — mobile/tablet only (button is hidden on desktop by CSS, and
  // app.js further gates its enable state on Exporter.isMobileOrTablet).
  // Mirrors the download flow: deselect text boxes so the export render is
  // clean, hand off to Exporter.shareMeme, then redraw the editor. If the
  // platform doesn't support Web Share or the user cancels, shareMeme
  // internally falls back to a normal download.
  if (shareBtn) {
    shareBtn.addEventListener('click', function () {
      var image = MemeGen.ImageLoader.getImage();
      var ctx = MemeGen.ImageLoader.getContext();
      var textBoxes = MemeGen.TextBoxManager.getAll();

      textBoxes.forEach(function (tb) { tb.deselect(); });

      MemeGen.Exporter.shareMeme(canvas, ctx, image, textBoxes);

      setTimeout(function () {
        MemeGen.ImageLoader.redraw();
      }, 100);
    });
  }

  // Header search icon → toggle the meme-search overlay on mobile. Desktop
  // CSS keeps the section visible inline regardless, so this is purely
  // a mobile affordance, but the class toggle is harmless on desktop.
  if (searchIconBtn && memeSearchSection) {
    searchIconBtn.addEventListener('click', function () {
      var nowOpen = memeSearchSection.classList.toggle('is-open');
      searchIconBtn.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
    });
  }

  if (memeSearchCloseBtn && memeSearchSection) {
    memeSearchCloseBtn.addEventListener('click', function () {
      memeSearchSection.classList.remove('is-open');
      if (searchIconBtn) searchIconBtn.setAttribute('aria-expanded', 'false');
    });
  }

  // Scan Text is intentionally inert in this version (future OCR feature).
  // The button stays visible per the design but does NOT create a text
  // box and does NOT call TextBoxManager. The native disabled attribute
  // plus aria-disabled in the HTML are the source of truth.

  // Browse overlay close button (top-left of the search panel) → return to
  // the editor without selecting a meme. The editor's image/text boxes are
  // not torn down — back is a pure visual switch.
  if (mobileHomeBackBtn) {
    mobileHomeBackBtn.addEventListener('click', function () {
      showEditorView();
    });
  }

  // Browse Memes pill (bottom-actions row) → open the dark forest search
  // grid as a fullscreen overlay. The existing MemeSearch wiring renders
  // results into the same #meme-search-results grid as before.
  if (browseMemesBtn) {
    browseMemesBtn.addEventListener('click', function () {
      showBrowseView();
    });
  }

  // The legacy header back button has no role in the new editor-first
  // flow; it stays in the DOM for selector compatibility but is wired to
  // a no-op so click doesn't accidentally toggle anything stale.
  if (mobileBackBtn) {
    mobileBackBtn.addEventListener('click', function () { /* no-op */ });
  }

  // ── Font settings dropdown ("Fonts" button below the canvas) ──
  // The Fonts button (#font-settings-btn, formerly the gear in the top
  // controls row) opens a dropdown built from the shared
  // MemeGen.TextBox.FONTS list. Choosing a font calls
  // TextBoxManager.setFontForAll, which re-fonts every existing box AND
  // stores it as the default so future boxes match — i.e. the choice
  // applies to all text, current and future.
  if (fontSettingsBtn && fontSettingsMenu && MemeGen.TextBox && MemeGen.TextBox.FONTS) {
    // Build the menu items once from the shared font list.
    MemeGen.TextBox.FONTS.forEach(function (f) {
      var li = document.createElement('li');
      li.setAttribute('role', 'none');

      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'font-settings-item';
      item.setAttribute('role', 'menuitem');
      item.dataset.fontValue = f.value;
      item.textContent = f.label;
      // Preview each option in its own font so the choice is visible up-front.
      item.style.fontFamily = f.value;

      li.appendChild(item);
      fontSettingsMenu.appendChild(li);
    });

    function openFontMenu() {
      fontSettingsMenu.hidden = false;
      fontSettingsBtn.setAttribute('aria-expanded', 'true');
    }
    function closeFontMenu() {
      fontSettingsMenu.hidden = true;
      fontSettingsBtn.setAttribute('aria-expanded', 'false');
    }

    fontSettingsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (fontSettingsMenu.hidden) {
        openFontMenu();
      } else {
        closeFontMenu();
      }
    });

    fontSettingsMenu.addEventListener('click', function (e) {
      var item = e.target.closest('.font-settings-item');
      if (!item) return;
      MemeGen.TextBoxManager.setFontForAll(item.dataset.fontValue);
      closeFontMenu();
    });

    // Click anywhere outside the menu (or press Escape) closes it.
    document.addEventListener('click', function (e) {
      if (fontSettingsMenu.hidden) return;
      if (fontSettingsBtn.contains(e.target) || fontSettingsMenu.contains(e.target)) return;
      closeFontMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !fontSettingsMenu.hidden) closeFontMenu();
    });
  }

  // Circular + button on the home view → reuse the existing file picker.
  // ImageLoader's success callback then calls showEditorView().
  if (mobileHomePlusBtn && imageInput) {
    mobileHomePlusBtn.addEventListener('click', function () {
      imageInput.click();
    });
  }

  // (Real panda click handler lives further down with the AI panel wiring;
  // the duplicate placeholder that used to live here has been removed so
  // there is only one canonical AI-open behavior.)

  // Wire up meme search: when a result is clicked, load it onto the canvas
  // through the same pipeline as a normal upload.
  var searchInput = document.getElementById('meme-search-input');
  var searchResults = document.getElementById('meme-search-results');
  var searchStatus = document.getElementById('meme-search-status');
  var editorLibraryResults = document.getElementById('editor-library-results');
  var editorLibrarySearchInput = document.getElementById('editor-library-search-input');

  // Cached meme list for the editor preview's own search.
  var allEditorMemes = [];
  // Guard prevents duplicate input listeners if onFetched fires more than once.
  var editorPreviewListenerAdded = false;

  // Render (or re-render) cards into the editor preview container.
  function buildEditorPreviewCards(list) {
    if (!editorLibraryResults) return;
    editorLibraryResults.innerHTML = '';
    list.slice(0, 50).forEach(function (meme) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'meme-search-card';
      card.title = meme.name;

      var img = document.createElement('img');
      img.src = meme.url;
      img.alt = meme.name;
      img.loading = 'lazy';
      img.crossOrigin = 'anonymous';

      var label = document.createElement('span');
      label.className = 'meme-search-name';
      label.textContent = meme.name;

      card.appendChild(img);
      card.appendChild(label);
      card.addEventListener('click', function () {
        if (searchStatus) searchStatus.textContent = 'Loading ' + meme.name + '…';
        MemeGen.MemeSearch.loadFromUrl(meme.url, function (err) {
          if (searchStatus) searchStatus.textContent =
            'Could not load that meme: ' + (err && err.message ? err.message : 'unknown error');
        });
      });

      editorLibraryResults.appendChild(card);
    });
  }

  // Filter the cached meme list by the preview search query and re-render.
  function filterEditorPreview() {
    var query = (editorLibrarySearchInput ? editorLibrarySearchInput.value : '').trim().toLowerCase();
    var filtered = query
      ? allEditorMemes.filter(function (m) { return m.name.toLowerCase().indexOf(query) !== -1; })
      : allEditorMemes;
    buildEditorPreviewCards(filtered);
  }

  // Called by MemeSearch's onFetched callback. Sets up the preview once;
  // subsequent calls update the cache but skip re-adding input listeners.
  function renderEditorPreview(memesData) {
    if (!editorLibraryResults) return;
    allEditorMemes = memesData;
    buildEditorPreviewCards(memesData);

    if (!editorPreviewListenerAdded && editorLibrarySearchInput) {
      editorPreviewListenerAdded = true;
      var debounce = null;
      editorLibrarySearchInput.addEventListener('input', function () {
        clearTimeout(debounce);
        debounce = setTimeout(filterEditorPreview, 150);
      });
      editorLibrarySearchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          clearTimeout(debounce);
          filterEditorPreview();
          e.preventDefault();
        }
      });
    }
  }

  if (searchInput && searchResults && MemeGen.MemeSearch) {
    MemeGen.MemeSearch.init({
      input: searchInput,
      results: searchResults,
      status: searchStatus,
      onFetched: renderEditorPreview,
      onSelect: function (meme) {
        // Close the Browse Memes overlay up-front so the user sees the
        // "Loading…" status against the editor instead of the search
        // grid. ImageLoader's callback also calls showEditorView, so
        // this is idempotent.
        showEditorView();
        // Show a loading message; it is cleared by the ImageLoader success
        // callback on load, or replaced with an error here if the load fails.
        searchStatus.textContent = 'Loading ' + meme.name + '…';
        MemeGen.MemeSearch.loadFromUrl(meme.url, function (err) {
          searchStatus.textContent =
            'Could not load that meme: ' + (err && err.message ? err.message : 'unknown error');
        });
      }
    });
  }

  // Wire up AI suggestions. When a card is picked, load the template through
  // the same pipeline as meme search and pre-populate text boxes from the
  // returned captions (top + bottom).
  function populatePresetCaptions(containerEl, captions) {
    if (!Array.isArray(captions) || captions.length === 0) return;

    // Picking a new AI suggestion replaces the meme — drop any existing text
    // boxes so the new captions don't stack on top of the old ones.
    // slice() because destroy() splices the live array via onDelete.
    MemeGen.TextBoxManager.getAll().slice().forEach(function (tb) {
      tb.destroy();
    });

    var w = containerEl.offsetWidth  || 600;
    var h = containerEl.offsetHeight || 400;
    // 200×60 is the TextBox default size; center horizontally, top/bottom pad.
    var boxW = 200;
    var x = Math.max(0, Math.round((w - boxW) / 2));
    var items = [
      { x: x, y: Math.round(h * 0.06),                       text: captions[0] || '' },
      { x: x, y: Math.max(0, Math.round(h * 0.78)),          text: captions[1] || '' }
    ];
    MemeGen.TextBoxManager.createBatch(items);
  }

    // ── AI suggestions panels ─
  // Desktop and mobile use separate IDs/panels so their layout and behavior
  // do not fight over the same DOM nodes.
  var desktopAiPanel = document.getElementById('desktop-ai-suggestions-panel');
  var desktopAiCloseBtn = document.getElementById('desktop-ai-close-btn');
  var desktopAiBtn = document.getElementById('desktop-ai-btn');
  var desktopAiStatus = document.getElementById('desktop-ai-status');

  var mobileAiPanel = document.getElementById('mobile-ai-suggestions-panel');
  var mobileAiCloseBtn = document.getElementById('mobile-ai-close-btn');

  if (desktopAiPanel) {
    desktopAiPanel.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  }

  if (mobileAiPanel) {
    mobileAiPanel.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  }

  function isDesktopLayout() {
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(min-width: 769px)').matches;
  }

  // Open/close helpers per panel — NO layout guards here. CSS media queries
  // (.desktop-ai-panel / .mobile-ai-panel) decide which panel is visible,
  // so JS only flips `hidden` on both and lets CSS handle which one paints.
  function openDesktopAiPanel() {
    if (!desktopAiPanel) return;
    desktopAiPanel.hidden = false;
    if (desktopAiBtn) desktopAiBtn.setAttribute('aria-expanded', 'true');
    var identityInput = document.getElementById('desktop-ai-identity');
    if (identityInput && isDesktopLayout()) identityInput.focus();
  }

  function closeDesktopAiPanel() {
    if (!desktopAiPanel) return;
    desktopAiPanel.hidden = true;
    if (desktopAiBtn) desktopAiBtn.setAttribute('aria-expanded', 'false');
  }

  function openMobileAiPanel() {
    if (!mobileAiPanel) return;
    mobileAiPanel.hidden = false;
    if (aiPandaBtn) aiPandaBtn.setAttribute('aria-expanded', 'true');
    var identityInput = document.getElementById('mobile-ai-identity');
    if (identityInput && !isDesktopLayout()) identityInput.focus();
  }

  function closeMobileAiPanel() {
    if (!mobileAiPanel) return;
    mobileAiPanel.hidden = true;
    if (aiPandaBtn) aiPandaBtn.setAttribute('aria-expanded', 'false');
  }

  // Shared open/close that both buttons use. CSS decides which panel paints.
  function openAiPanels() {
    openDesktopAiPanel();
    openMobileAiPanel();
    showAiLibraryEmptyState();
  }

  function closeAiPanels() {
    closeDesktopAiPanel();
    closeMobileAiPanel();
  }

  if (desktopAiCloseBtn) {
    desktopAiCloseBtn.addEventListener('click', exitAiLibraryMode);
  }

  if (mobileAiCloseBtn) {
    mobileAiCloseBtn.addEventListener('click', exitAiLibraryMode);
  }

  if (aiPandaBtn) {
    aiPandaBtn.addEventListener('click', function () {
      // Use the panel's own hidden state (not viewport) so the toggle
      // works identically on desktop and mobile.
      if (mobileAiPanel && mobileAiPanel.hidden) {
        openAiPanels();
      } else {
        exitAiLibraryMode();
      }
    });
  }
  // ── AI library mode (desktop right-side library swap) ──
  var aiGeneratedSuggestions = [];

  function renderAiLibraryBackButton() {
    if (!searchResults) return null;

    var back = document.createElement('button');
    back.type = 'button';
    back.className = 'ai-library-back';
    back.id = 'ai-library-back-btn';
    back.textContent = '← Back to templates';
    back.addEventListener('click', exitAiLibraryMode);
    searchResults.appendChild(back);

    return back;
  }

  function showAiLibraryEmptyState() {
    if (!searchResults) return;

    searchResults.innerHTML = '';

    renderAiLibraryBackButton();

    var msg = document.createElement('p');
    msg.className = 'ai-library-message';
    msg.textContent = 'Please generate to see AI memes';
    searchResults.appendChild(msg);
  }

  function showAiLibraryLoadingState() {
    if (!searchResults) return;

    searchResults.innerHTML = '';

    renderAiLibraryBackButton();

    var msg = document.createElement('p');
    msg.className = 'ai-library-message';
    msg.textContent = 'Generating AI meme suggestions...';
    searchResults.appendChild(msg);
  }

  function showAiLibraryErrorState(err) {
    if (!searchResults) return;

    searchResults.innerHTML = '';

    renderAiLibraryBackButton();

    var msg = document.createElement('p');
    msg.className = 'ai-library-message';
    msg.textContent = 'Could not generate AI memes: ' +
      (err && err.message ? err.message : 'unknown error');
    searchResults.appendChild(msg);
  }

  function selectAiSuggestion(suggestion) {
    if (searchStatus) searchStatus.textContent = 'Loading ' + suggestion.name + '…';

    MemeGen.pendingAICaptions = suggestion.captions || [];
    // Close BOTH panels — selection can fire from either surface, and on
    // mobile we also need to return to the editor view so the user sees
    // the canvas update instead of staying on the Browse Memes overlay.
    closeAiPanels();
    if (!isDesktopLayout()) {
      showEditorView();
    }

    MemeGen.MemeSearch.loadFromUrl(suggestion.url, function (err) {
      MemeGen.pendingAICaptions = null;

      if (searchStatus) {
        searchStatus.textContent =
          'Could not load that template: ' +
          (err && err.message ? err.message : 'unknown error');
      }
    });
  }

  function renderAiSuggestionsInLibrary(suggestions) {
    if (!searchResults) return;

    aiGeneratedSuggestions = Array.isArray(suggestions) ? suggestions : [];
    searchResults.innerHTML = '';

    renderAiLibraryBackButton();

    if (aiGeneratedSuggestions.length === 0) {
      var msg = document.createElement('p');
      msg.className = 'ai-library-message';
      msg.textContent = 'No AI suggestions returned. Try a different prompt.';
      searchResults.appendChild(msg);
      return;
    }

    aiGeneratedSuggestions.forEach(function (suggestion) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'meme-search-card ai-suggestion-card';
      card.title = suggestion.name;
      card.setAttribute('data-template-id', suggestion.id || '');

      var img = document.createElement('img');
      img.src = suggestion.url;
      img.alt = suggestion.name;
      img.loading = 'lazy';
      img.crossOrigin = 'anonymous';

      var label = document.createElement('span');
      label.className = 'meme-search-name';
      label.textContent = suggestion.name;

      card.appendChild(img);
      card.appendChild(label);

      card.addEventListener('click', function () {
        selectAiSuggestion(suggestion);
      });

      searchResults.appendChild(card);
    });
  }

  function exitAiLibraryMode() {
    aiGeneratedSuggestions = [];

    closeAiPanels();

    if (!searchResults || !MemeGen.MemeSearch) return;

    searchResults.innerHTML = '';

    if (searchInput) {
      searchInput.value = '';
      try {
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      } catch {
        // ignore old browser/jsdom event issues
      }
    }
  }

  if (desktopAiBtn) {
    desktopAiBtn.addEventListener('click', function () {
      // Use the desktop panel's hidden state for symmetry with the panda
      // button. CSS hides the desktop panel on mobile, but the JS toggle
      // works on whichever panel the user is actually looking at.
      if (desktopAiPanel && desktopAiPanel.hidden) {
        openAiPanels();
      } else {
        exitAiLibraryMode();
      }
    });
  }

  // Shared onSelect handler used by both AI panel inits. Both panels feed
  // the same load pipeline; the panel that fired the selection closes
  // alongside its sibling so the user never sees a stale half-open UI.
  function makeAiSelectHandler(statusEl) {
    return function (template, captions) {
      if (statusEl) statusEl.textContent = 'Loading ' + template.name + '…';

      MemeGen.pendingAICaptions = captions;
      closeAiPanels();
      if (!isDesktopLayout()) {
        showEditorView();
      }

      MemeGen.MemeSearch.loadFromUrl(template.url, function (err) {
        MemeGen.pendingAICaptions = null;

        if (statusEl) {
          statusEl.textContent =
            'Could not load that template: ' +
            (err && err.message ? err.message : 'unknown error');
        }
      });
    };
  }

  if (desktopAiPanel && MemeGen.AISuggestions) {
    MemeGen.AISuggestions.init({
      root: desktopAiPanel,
      form: document.getElementById('desktop-ai-form'),
      identity: document.getElementById('desktop-ai-identity'),
      situation: document.getElementById('desktop-ai-situation'),
      generateBtn: document.getElementById('desktop-ai-generate-btn'),
      keyForm: document.getElementById('desktop-ai-key-form'),
      keyInput: document.getElementById('desktop-ai-key-input'),
      keySaveBtn: document.getElementById('desktop-ai-key-save-btn'),
      changeKeyLink: document.getElementById('desktop-ai-change-key'),
      status: desktopAiStatus,
      results: document.getElementById('desktop-ai-results'),

      onGenerateStart: showAiLibraryLoadingState,
      onGenerated: renderAiSuggestionsInLibrary,
      onGenerateError: showAiLibraryErrorState,

      onSelect: makeAiSelectHandler(desktopAiStatus)
    });
  }

  // Mobile AI panel — separate IDs, separate AISuggestions instance so the
  // mobile form keeps its own status/results, but it feeds the same load
  // pipeline (and the same right-side library AI mode helpers on tablets
  // that satisfy isDesktopLayout()).
  var mobileAiStatus = document.getElementById('mobile-ai-status');
  if (mobileAiPanel && MemeGen.AISuggestions) {
    MemeGen.AISuggestions.init({
      root: mobileAiPanel,
      form: document.getElementById('mobile-ai-form'),
      identity: document.getElementById('mobile-ai-identity'),
      situation: document.getElementById('mobile-ai-situation'),
      generateBtn: document.getElementById('mobile-ai-generate-btn'),
      keyForm: document.getElementById('mobile-ai-key-form'),
      keyInput: document.getElementById('mobile-ai-key-input'),
      keySaveBtn: document.getElementById('mobile-ai-key-save-btn'),
      changeKeyLink: document.getElementById('mobile-ai-change-key'),
      status: mobileAiStatus,
      results: document.getElementById('mobile-ai-results'),

      onGenerateStart: showAiLibraryLoadingState,
      onGenerated: renderAiSuggestionsInLibrary,
      onGenerateError: showAiLibraryErrorState,

      onSelect: makeAiSelectHandler(mobileAiStatus)
    });
  }
});

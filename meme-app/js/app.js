// DOMContentLoaded fires once the HTML is parsed but before images and
// stylesheets finish loading — all DOM elements queried below are available.
document.addEventListener('DOMContentLoaded', function () {
  var canvas = document.getElementById('meme-canvas');
  var container = document.getElementById('canvas-container');
  var imageInput = document.getElementById('image-input');
  var downloadBtn = document.getElementById('download-btn');
  var shareBtn = document.getElementById('share-btn');
  var copyBtn = document.getElementById('copy-btn');
  var scanTextBtn = document.getElementById('scan-text-btn');
  var searchIconBtn = document.getElementById('search-icon-btn');
  var memeSearchSection = document.getElementById('meme-search');
  var memeSearchCloseBtn = document.getElementById('meme-search-close');
  var mobileBackBtn = document.getElementById('mobile-back-btn');
  var mobileHomeBackBtn = document.getElementById('mobile-home-back-btn');
  var mobileHomePlusBtn = document.getElementById('mobile-home-plus-btn');
  var mobileAiBtn = document.getElementById('mobile-ai-btn');
  var browseMemesBtn = document.getElementById('browse-memes-btn');
  var mobileFontsBtn = document.getElementById('mobile-fonts-btn');
  var fontsBtn = document.getElementById('fonts-btn');
  var fontSettingsBtn = document.getElementById('font-settings-btn');
  var fontSettingsMenu = document.getElementById('font-settings-menu');
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
    // Let CSS control the display size via aspect-ratio + min() width.
    // JS only sets the custom properties so the CSS formula has the values it needs.
    container.style.removeProperty('width');
    container.style.removeProperty('height');
    container.style.setProperty('--canvas-aspect-ratio', width + ' / ' + height);
    container.style.setProperty('--canvas-ratio-num', (width / height).toFixed(4));
    container.classList.add('has-image');
    placeholder.hidden = true;
    hint.hidden = false;
    downloadBtn.disabled = false;
    if (copyBtn) copyBtn.disabled = false;
    // Enable both; CSS media queries decide which one is visible.
    if (shareBtn) shareBtn.disabled = false;
    // Scan Text stays disabled in this version — see the inert button
    // contract below. Do NOT enable it when an image loads.
    MemeGen.TextBoxManager.setImageLoaded(true);
    // Clear any "Loading…" message left over from the meme-search flow.
    var s = document.getElementById('meme-search-status');
    if (s) s.textContent = '';
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

    // If an AI suggestion is pending its captions, populate the text boxes
    // now that the canvas is sized. Deferred one tick so layout fully
    // commits before we measure the container for box placement.
    if (MemeGen.pendingAICaptions && Array.isArray(MemeGen.pendingAICaptions)) {
      var caps = MemeGen.pendingAICaptions;
      MemeGen.pendingAICaptions = null;
      setTimeout(function () { populatePresetCaptions(container, caps); }, 0);
    }
  });

  MemeGen.TextBoxManager.init(container, canvas);

  if (
    typeof ResizeObserver === 'function' &&
    container &&
    typeof MemeGen.TextBoxManager.syncTextBoxesToCanvas === 'function'
  ) {
    var ro = new ResizeObserver(function () {
      MemeGen.TextBoxManager.syncTextBoxesToCanvas();
    });
    ro.observe(container);
  }

  MemeGen.LayoutManager.init('panel-resizer', 'meme-search');

  // On mobile, boot into the Browse Memes overlay so the first thing the user
  // sees is the meme template grid. Share/Download visibility is handled
  // entirely by CSS media queries — no inline style overrides needed.
  if (MemeGen.Exporter.isMobileOrTablet()) {
    showBrowseView();
  }

  imageInput.addEventListener('change', function () {
    if (this.files && this.files[0]) {
      if (MemeGen.FileValidator.validate(this.files[0])) {
        MemeGen.ImageLoader.loadFromFile(this.files[0]);
      }
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
      // In AI mode the canvas is a blank target for the chosen suggestion —
      // drag-and-drop upload is disabled.
      if (document.body.classList.contains('ai-mode')) return;
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
      if (document.body.classList.contains('ai-mode')) return;
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
    if (document.body.classList.contains('ai-mode')) return;
    e.preventDefault();
    e.stopPropagation();
    container.classList.remove('drag-over');
    var file = firstImageFile(e.dataTransfer && e.dataTransfer.files);
    if (file) {
      if (MemeGen.FileValidator.validate(file)) {
        MemeGen.ImageLoader.loadFromFile(file);
      }
    } else if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      alert('Please drop an image file.');
    }
  });

  // Click the empty canvas region to open the file picker. Once an image
  // is loaded, clicks inside the canvas are reserved for adding text boxes,
  // so we gate on .has-image to avoid hijacking that interaction.
  container.addEventListener('click', function (e) {
  if (container.classList.contains('has-image')) return;

  // Do not open the file picker when clicking inside overlay UI such as
  // the AI suggestions panel.
  if (e.target.closest('#desktop-ai-suggestions-panel')) return;

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

  // Copy meme PNG to the clipboard. Mirrors download/share: pull the
  // ImageLoader image + ctx, snapshot the live text boxes, deselect them
  // so selection borders aren't baked into the render, hand off to
  // Exporter.copyMeme (which goes through the same getMemeBlob pipeline
  // as Download/Share), then redraw the editor view so the selection UI
  // returns. Copy success / failure feed back through the #hint element
  // so the user sees the outcome without a layout shift.
  function showCopyStatus(message) {
    if (!hint) return;
    var prevText = hint.textContent;
    var prevHidden = hint.hidden;
    hint.textContent = message;
    hint.hidden = false;
    setTimeout(function () {
      hint.textContent = prevText;
      hint.hidden = prevHidden;
    }, 2500);
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', function () { 
      var image = MemeGen.ImageLoader.getImage();
      var ctx = MemeGen.ImageLoader.getContext();
      var textBoxes = MemeGen.TextBoxManager.getAll();

      textBoxes.forEach(function (tb) { tb.deselect(); });

      MemeGen.Exporter.copyMeme(canvas, ctx, image, textBoxes, function (err) {
        MemeGen.ImageLoader.redraw();
        if (err) {
          // Browsers without clipboard image support land here. Point the
          // user at Download — that path works everywhere.
          showCopyStatus('Copy is not supported in this browser. Try Download instead.');
          return;
        }
        showCopyStatus('Copied meme to clipboard');
      });
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

  // ── Fonts button (Screen 13) ──
  // Cycles EVERY existing text box through the meme-font list below, each
  // advancing one step from its own current font (with wrap). Dispatching
  // a bubbling `change` event on each fontSelect runs TextBox's existing
  // change listener — the same path the normal per-box dropdown takes —
  // so live update and export both stay consistent. If a text box's
  // current font isn't in the cycle list, it starts at the first entry
  // ('Impact'). If there are no text boxes, surface the discovery hint.
  var MEME_FONTS = ['Impact', 'Arial', "'Comic Sans MS', cursive"];

  function cycleFontForTextBox(tb) {
    if (!tb || !tb.fontSelect) return;
    var current = tb.fontSelect.value;
    var idx = MEME_FONTS.indexOf(current);
    var next = idx === -1
      ? MEME_FONTS[0]
      : MEME_FONTS[(idx + 1) % MEME_FONTS.length];
    tb.fontSelect.value = next;
    tb.fontSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  if (fontsBtn) {
    fontsBtn.addEventListener('click', function () {
      var boxes = (MemeGen.TextBoxManager && typeof MemeGen.TextBoxManager.getAll === 'function')
        ? MemeGen.TextBoxManager.getAll() : [];
      if (boxes.length === 0) {
        if (hint) {
          var prev = hint.textContent;
          var wasHidden = hint.hidden;
          hint.textContent = 'Add or select text to change fonts';
          hint.hidden = false;
          setTimeout(function () {
            hint.textContent = prev;
            hint.hidden = wasHidden;
          }, 3000);
        }
        return;
      }
      boxes.forEach(cycleFontForTextBox);
    });
  }

  // ── Font picker dropdown ("Font" pill above the canvas's top-left corner) ──
  // The pill opens a dropdown built from the shared MemeGen.TextBox.FONTS
  // list. Choosing a font calls TextBoxManager.setFontForAll, which re-fonts
  // every existing box AND stores it as the default so future boxes match —
  // i.e. the choice applies to all text, current and future.
  // The pill lives inside #canvas-container, whose click handler opens the
  // file picker while no image is loaded — so every handler below stops
  // propagation to keep font interactions from triggering an upload.
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

    function openFontMenu(triggerEl) {
      fontSettingsMenu.hidden = false;
      if (triggerEl && window.innerWidth >= 769) {
        // Desktop: menu is inside off-screen .mobile-fonts-row (visibility:hidden).
        // Override with position:fixed + visibility:visible so it appears at the
        // correct viewport position relative to the triggering button.
        var rect = triggerEl.getBoundingClientRect();
        fontSettingsMenu.style.position   = 'fixed';
        fontSettingsMenu.style.visibility = 'visible';
        fontSettingsMenu.style.top    = (rect.bottom + 6) + 'px';
        fontSettingsMenu.style.left   = Math.min(rect.left, window.innerWidth - 190) + 'px';
        fontSettingsMenu.style.bottom = 'auto';
        fontSettingsMenu.style.transform = 'none';
      } else {
        // Mobile: CSS handles position (absolute, below the Fonts button).
        // Clear any desktop inline styles so the media-query rules apply.
        fontSettingsMenu.style.removeProperty('position');
        fontSettingsMenu.style.removeProperty('visibility');
        fontSettingsMenu.style.removeProperty('top');
        fontSettingsMenu.style.removeProperty('left');
        fontSettingsMenu.style.removeProperty('bottom');
        fontSettingsMenu.style.removeProperty('transform');
      }
      if (fontSettingsBtn) fontSettingsBtn.setAttribute('aria-expanded', 'true');
      if (mobileFontsBtn)  mobileFontsBtn.setAttribute('aria-expanded', 'true');
    }
    function closeFontMenu() {
      fontSettingsMenu.hidden = true;
      fontSettingsMenu.style.removeProperty('position');
      fontSettingsMenu.style.removeProperty('visibility');
      fontSettingsMenu.style.removeProperty('top');
      fontSettingsMenu.style.removeProperty('left');
      fontSettingsMenu.style.removeProperty('bottom');
      fontSettingsMenu.style.removeProperty('transform');
      if (fontSettingsBtn) fontSettingsBtn.setAttribute('aria-expanded', 'false');
      if (mobileFontsBtn)  mobileFontsBtn.setAttribute('aria-expanded', 'false');
    }

    fontSettingsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (fontSettingsMenu.hidden) { openFontMenu(fontSettingsBtn); } else { closeFontMenu(); }
    });

    // Mobile Fonts button: same toggle, positioned above the bottom bar by CSS.
    if (mobileFontsBtn) {
      mobileFontsBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (fontSettingsMenu.hidden) { openFontMenu(mobileFontsBtn); } else { closeFontMenu(); }
      });
    }

    fontSettingsMenu.addEventListener('click', function (e) {
      // Stop the click from reaching #canvas-container (which would open the
      // file picker when no image is loaded yet).
      e.stopPropagation();
      var item = e.target.closest('.font-settings-item');
      if (!item) return;
      MemeGen.TextBoxManager.setFontForAll(item.dataset.fontValue);
      closeFontMenu();
    });

    // Click anywhere outside the menu (or press Escape) closes it.
    document.addEventListener('click', function (e) {
      if (fontSettingsMenu.hidden) return;
      if (fontSettingsBtn && fontSettingsBtn.contains(e.target)) return;
      if (mobileFontsBtn  && mobileFontsBtn.contains(e.target))  return;
      if (fontSettingsMenu.contains(e.target)) return;
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
  var editorLibraryPreview = document.getElementById('editor-library-preview');
  var editorLibraryResults = document.getElementById('editor-library-results');
  var editorLibrarySearchInput = document.getElementById('editor-library-search-input');

  // Cached meme list for the editor preview's own search.
  var allEditorMemes = [];
  // Guard prevents duplicate input listeners if onFetched fires more than once.
  var editorPreviewListenerAdded = false;

  // AI suggestions stored after generation — persist until AI Mode is turned OFF.
  var aiGeneratedSuggestions = [];
  var selectedAiSuggestionIndex = -1;

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

  // ── AI suggestions (AI-Mode toggle, #87) ─────────────────────────────────
  // The header "AI Mode" pill reveals #desktop-ai-suggestions-panel in place
  // of the template library (see body.ai-mode CSS). On desktop it shows inline
  // in the right panel (canvas stays left); on mobile it shows as a fullscreen
  // overlay. The pill replaced the inert ⚙ settings button. The 🐼 panda
  // buttons and the separate mobile panel were removed.
  var desktopAiPanel = document.getElementById('desktop-ai-suggestions-panel');

  // Add body.ai-popup-dismissed to hide the mobile AI bottom-sheet without
  // exiting AI mode — used after the user selects a suggestion.
  function openMobileAiPanel() {
    document.body.classList.remove('ai-popup-dismissed');
  }
  function closeMobileAiPanel() {
    document.body.classList.add('ai-popup-dismissed');
  }

  // Renders the stored AI suggestions as small cards in the editor library
  // preview section (below the canvas on mobile). Only runs on mobile in
  // ai-mode — CSS handles the section's visibility, this just fills the content.
  function renderMobileAiEditorPreview() {
    if (!editorLibraryResults) return;
    if (!MemeGen.Exporter.isMobileOrTablet()) return;
    if (!document.body.classList.contains('ai-mode')) return;

    if (editorLibrarySearchInput) editorLibrarySearchInput.hidden = true;
    editorLibraryResults.innerHTML = '';

    if (!aiGeneratedSuggestions.length) {
      var empty = document.createElement('p');
      empty.className = 'editor-library-empty';
      empty.textContent = 'Generate AI memes to see options here.';
      editorLibraryResults.appendChild(empty);
      return;
    }

    aiGeneratedSuggestions.forEach(function (suggestion, index) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'meme-search-card editor-ai-preview-card';
      if (index === selectedAiSuggestionIndex) card.classList.add('selected');

      var previewWrap = document.createElement('div');
      previewWrap.className = 'ai-preview-wrap';

      var img = document.createElement('img');
      img.src = suggestion.url;
      img.alt = suggestion.name || 'AI suggestion';
      img.loading = 'lazy';
      img.crossOrigin = 'anonymous';
      previewWrap.appendChild(img);

      var captions = Array.isArray(suggestion.captions) ? suggestion.captions : [];
      captions.slice(0, 2).forEach(function (caption, captionIndex) {
        var captionEl = document.createElement('span');
        captionEl.className = 'ai-preview-caption ' +
          (captionIndex === 0 ? 'ai-preview-caption-top' : 'ai-preview-caption-bottom');
        captionEl.textContent = caption;
        previewWrap.appendChild(captionEl);
      });

      var label = document.createElement('span');
      label.className = 'meme-search-name';
      label.textContent = suggestion.name || 'AI suggestion';

      card.appendChild(previewWrap);
      card.appendChild(label);

      var captionList = document.createElement('ul');
      captionList.className = 'ai-caption-list visually-hidden';
      captions.forEach(function (caption) {
        var li = document.createElement('li');
        li.textContent = caption;
        captionList.appendChild(li);
      });
      card.appendChild(captionList);

      card.addEventListener('click', function () {
        selectAiSuggestion(suggestion, index);
      });

      editorLibraryResults.appendChild(card);
    });
  }

  // Shared handler for selecting an AI suggestion from either the popup or
  // the under-editor preview. Closes the popup on mobile, loads the meme,
  // and re-renders the preview with the new selection highlighted.
  function selectAiSuggestion(suggestion, index) {
    selectedAiSuggestionIndex = index;
    MemeGen.pendingAICaptions = suggestion.captions || [];

    if (MemeGen.Exporter.isMobileOrTablet()) {
      closeMobileAiPanel();
      showEditorView();
    }

    if (desktopAiStatus) desktopAiStatus.textContent = 'Loading ' + (suggestion.name || 'meme') + '…';

    MemeGen.MemeSearch.loadFromUrl(suggestion.url, function (err) {
      MemeGen.pendingAICaptions = null;
      if (desktopAiStatus) {
        desktopAiStatus.textContent =
          'Could not load that template: ' + (err && err.message ? err.message : 'unknown error');
      }
    });

    renderMobileAiEditorPreview();
  }
  var desktopAiStatus = document.getElementById('desktop-ai-status');
  var desktopAiCloseBtn = document.getElementById('desktop-ai-close-btn');
  var aiModeToggle = document.getElementById('ai-mode-toggle');

  // Single source of truth for entering/leaving AI mode. Toggles body.ai-mode
  // (which the CSS keys off) and mirrors the state onto the header pill.
  function setAiMode(on) {
    document.body.classList.toggle('ai-mode', on);
    if (aiModeToggle) {
      aiModeToggle.setAttribute('aria-pressed', String(on));
      aiModeToggle.textContent = on ? 'AI Mode: ON' : 'AI Mode: OFF';
      aiModeToggle.title = on
        ? 'Switch back to normal mode'
        : 'Switch to AI suggestion mode';
    }
    if (on) {
      openMobileAiPanel();
      renderMobileAiEditorPreview();
      if (!MemeGen.Exporter.isMobileOrTablet()) {
        var identityInput = document.getElementById('desktop-ai-identity');
        if (identityInput) identityInput.focus();
      }
    } else {
      closeMobileAiPanel();
      aiGeneratedSuggestions = [];
      selectedAiSuggestionIndex = -1;
      // Restore the search input and normal templates in the editor preview.
      if (editorLibrarySearchInput) editorLibrarySearchInput.hidden = false;
      buildEditorPreviewCards(allEditorMemes);
    }
  }

  // Clicks inside the panel should not bubble out to the canvas/file-picker.
  if (desktopAiPanel) {
    desktopAiPanel.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  }

  // The panel's × is hidden on desktop (header toggle controls visibility) but
  // visible on mobile, where it exits AI mode.
  if (desktopAiCloseBtn) {
    desktopAiCloseBtn.addEventListener('click', function () {
      // On mobile: if suggestions already exist, just close the popup and
      // show the under-editor preview — keep body.ai-mode active. Only exit
      // AI mode fully when there are no suggestions yet.
      if (MemeGen.Exporter.isMobileOrTablet() && aiGeneratedSuggestions.length > 0) {
        closeMobileAiPanel();
        renderMobileAiEditorPreview();
      } else {
        setAiMode(false);
      }
    });
  }

  // Wire the panel's form to the AISuggestions controller. Generated cards
  // render inside the panel (#desktop-ai-results); picking one loads the
  // template through the same meme-search pipeline and stashes its captions
  // for ImageLoader.onLoad to apply once the canvas is sized.
  if (desktopAiPanel && MemeGen.AISuggestions) {
    MemeGen.AISuggestions.init({
      root: desktopAiPanel,
      // No getBtn — the AI-Mode toggle controls panel visibility, so the
      // form is revealed on init.
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
      onGenerated: function (suggestions) {
        aiGeneratedSuggestions = suggestions || [];
        selectedAiSuggestionIndex = -1;
        renderMobileAiEditorPreview();
      },
      onSelect: function (template, captions) {
        // Find the matching stored suggestion so selectAiSuggestion can track
        // the index and reuse the same load path for both popup and preview.
        var idx = -1;
        for (var i = 0; i < aiGeneratedSuggestions.length; i++) {
          if (aiGeneratedSuggestions[i].url === template.url) { idx = i; break; }
        }
        if (idx !== -1) {
          selectAiSuggestion(aiGeneratedSuggestions[idx], idx);
        } else {
          // Fallback: suggestion not in stored list (edge case on desktop).
          if (desktopAiStatus) desktopAiStatus.textContent = 'Loading ' + template.name + '…';
          if (MemeGen.Exporter.isMobileOrTablet()) { closeMobileAiPanel(); showEditorView(); }
          MemeGen.pendingAICaptions = captions;
          MemeGen.MemeSearch.loadFromUrl(template.url, function (err) {
            MemeGen.pendingAICaptions = null;
            if (desktopAiStatus) {
              desktopAiStatus.textContent =
                'Could not load that template: ' + (err && err.message ? err.message : 'unknown error');
            }
          });
        }
      }
    });
  }

  // ── AI mode toggle (#87) ─────────────────────────────────────────────────
  // Tapping the header pill flips `ai-mode` on <body>, which the CSS keys off
  // to swap the library for the AI panel (inline on desktop, fullscreen overlay
  // on mobile). See setAiMode above for the state mirroring.
  if (aiModeToggle) {
    aiModeToggle.addEventListener('click', function () {
      setAiMode(!document.body.classList.contains('ai-mode'));
    });
  }

  // Mobile browse page AI button — switches to editor view and activates AI mode.
  if (mobileAiBtn) {
    mobileAiBtn.addEventListener('click', function () {
      showEditorView();
      setAiMode(true);
    });
  }

  // ── Theme toggle (#89) ───────────────────────────────────────────────────
  // Wires the header pill so clicking it flips data-theme on <html> and
  // saves the choice. ThemeToggle.init also applies the stored or system
  // preference on first paint.
  if (MemeGen.ThemeToggle) {
    MemeGen.ThemeToggle.init({
      toggle: document.getElementById('theme-toggle')
    });
  }
});

document.addEventListener('DOMContentLoaded', function () {
  var canvas = document.getElementById('meme-canvas');
  var container = document.getElementById('canvas-container');
  var imageInput = document.getElementById('image-input');
  var downloadBtn = document.getElementById('download-btn');
  var shareBtn = document.getElementById('share-btn');
  var placeholder = document.getElementById('placeholder');
  var hint = document.getElementById('hint');

  MemeGen.ImageLoader.init(canvas, function (width, height) {
    container.style.width = width + 'px';
    container.style.height = height + 'px';
    container.classList.add('has-image');
    placeholder.hidden = true;
    hint.hidden = false;
    downloadBtn.disabled = false;
    if (shareBtn && MemeGen.Exporter.isMobileOrTablet()) shareBtn.disabled = false;
    MemeGen.TextBoxManager.setImageLoaded(true);
  });

  MemeGen.TextBoxManager.init(container, canvas);

  // Show share button on mobile/tablet only; keep it hidden on desktop.
  if (shareBtn && MemeGen.Exporter.isMobileOrTablet()) {
    shareBtn.style.display = 'inline-block';
  }

  imageInput.addEventListener('change', function () {
    if (this.files && this.files[0]) {
      MemeGen.ImageLoader.loadFromFile(this.files[0]);
    }
  });

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
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      container.classList.add('drag-over');
    });
  });

  ['dragleave', 'dragend'].forEach(function (evt) {
    container.addEventListener(evt, function (e) {
      e.preventDefault();
      e.stopPropagation();
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

  // Block the browser from opening the file if the drop misses the container.
  ['dragover', 'drop'].forEach(function (evt) {
    window.addEventListener(evt, function (e) {
      if (!container.contains(e.target)) e.preventDefault();
    });
  });

  // External meme search wiring (prepared for the future MemeSearch.js
  // branch). If MemeSearch.js and its DOM are present, initialize it with
  // the documented option shape and route selections through it. If either
  // is missing — which is the current state of the mobile-adaptability
  // branch — we no-op so the editor still works on its own.

  var memeSearchSection = document.getElementById('meme-search');
  var memeSearchStatus = document.getElementById('meme-search-status');

  // ── Mobile library compaction (used by the external meme-search section)
  // On phones (≤768 px) the section defaults to a collapsed horizontal strip
  // so the editor stays the focus. A "Show more" toggle button switches
  // between strip and full-grid views. Desktop hides the toggle via CSS and
  // never enters the collapsed state. The helpers are exported below for
  // the future MemeSearch.js to call directly if it prefers.
  function isMobileViewport() {
    return typeof window.innerWidth === 'number' && window.innerWidth <= 768;
  }

  function wireLibraryToggle(sectionEl, toggleBtnEl, expandedLabel, collapsedLabel) {
    if (!sectionEl || !toggleBtnEl) return;
    if (isMobileViewport()) {
      sectionEl.classList.add('is-collapsed');
      toggleBtnEl.hidden = false;
      toggleBtnEl.textContent = collapsedLabel;
      toggleBtnEl.setAttribute('aria-expanded', 'false');
    } else {
      sectionEl.classList.remove('is-collapsed');
      toggleBtnEl.hidden = true;
    }
    toggleBtnEl.addEventListener('click', function () {
      var collapsedNow = sectionEl.classList.toggle('is-collapsed');
      toggleBtnEl.textContent = collapsedNow ? collapsedLabel : expandedLabel;
      toggleBtnEl.setAttribute('aria-expanded', collapsedNow ? 'false' : 'true');
    });
  }

  function collapseSectionOnMobile(sectionEl, toggleBtnEl, collapsedLabel) {
    if (!isMobileViewport() || !sectionEl) return;
    sectionEl.classList.add('is-collapsed');
    if (toggleBtnEl) {
      toggleBtnEl.textContent = collapsedLabel;
      toggleBtnEl.setAttribute('aria-expanded', 'false');
    }
    if (container && typeof container.scrollIntoView === 'function') {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function handleExternalSearchError() {
    if (memeSearchStatus) {
      memeSearchStatus.textContent =
        'External meme search is unavailable. Try uploading an image instead.';
      memeSearchStatus.hidden = false;
    }
  }

  if (window.MemeGen && MemeGen.MemeSearch && document.getElementById('meme-search-input')) {
    if (memeSearchSection) memeSearchSection.hidden = false;
    var memeSearchToggle = document.getElementById('meme-search-toggle');
    wireLibraryToggle(
      memeSearchSection,
      memeSearchToggle,
      'Show fewer memes',
      'Show more memes'
    );
    MemeGen.MemeSearch.init({
      inputEl: document.getElementById('meme-search-input'),
      statusEl: memeSearchStatus,
      resultsEl: document.getElementById('meme-search-results'),
      onError: handleExternalSearchError,
      onSelect: function (meme) {
        if (!meme || !meme.url) return;
        MemeGen.MemeSearch.loadFromUrl(meme.url, handleExternalSearchError);
        collapseSectionOnMobile(memeSearchSection, memeSearchToggle, 'Show more memes');
      }
    });
  }

  downloadBtn.addEventListener('click', function () {
    var image = MemeGen.ImageLoader.getImage();
    var ctx = MemeGen.ImageLoader.getContext();
    var textBoxes = MemeGen.TextBoxManager.getAll();

    MemeGen.TextBoxManager.getAll().forEach(function (tb) {
      tb.deselect();
    });

    MemeGen.Exporter.exportMeme(canvas, ctx, image, textBoxes);

    setTimeout(function () {
      MemeGen.ImageLoader.redraw();
    }, 100);
  });

  if (shareBtn) {
    shareBtn.addEventListener('click', function () {
      var image = MemeGen.ImageLoader.getImage();
      var ctx = MemeGen.ImageLoader.getContext();
      var textBoxes = MemeGen.TextBoxManager.getAll();

      MemeGen.TextBoxManager.getAll().forEach(function (tb) {
        tb.deselect();
      });

      MemeGen.Exporter.shareMeme(canvas, ctx, image, textBoxes);

      setTimeout(function () {
        MemeGen.ImageLoader.redraw();
      }, 100);
    });
  }
});

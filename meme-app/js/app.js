document.addEventListener('DOMContentLoaded', function () {
  var canvas = document.getElementById('meme-canvas');
  var container = document.getElementById('canvas-container');
  var imageInput = document.getElementById('image-input');
  var downloadBtn = document.getElementById('download-btn');
  var detectTextBtn = document.getElementById('detect-text-btn');
  var placeholder = document.getElementById('placeholder');
  var hint = document.getElementById('hint');

  // Minimum Tesseract confidence (0–100) for a detected line to become a text box.
  // Lower = catches fainter/less-clear text, at the cost of more false positives.
  var MIN_OCR_CONFIDENCE = 60;

  MemeGen.ImageLoader.init(canvas, function (width, height) {
    container.style.width = width + 'px';
    container.style.height = height + 'px';
    container.classList.add('has-image');
    placeholder.hidden = true;
    hint.hidden = false;
    downloadBtn.disabled = false;
    detectTextBtn.disabled = false;
    MemeGen.TextBoxManager.setImageLoaded(true);
    // Clear any "Loading…" message left over from the meme-search flow.
    var s = document.getElementById('meme-search-status');
    if (s) s.textContent = '';
  });

  MemeGen.TextBoxManager.init(container, canvas);

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

  // Click the empty canvas region to open the file picker. Once an image
  // is loaded, clicks inside the canvas are reserved for adding text boxes,
  // so we gate on .has-image to avoid hijacking that interaction.
  container.addEventListener('click', function (e) {
    if (container.classList.contains('has-image')) return;
    imageInput.click();
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

    MemeGen.Exporter.exportMeme(canvas, ctx, image, textBoxes, MemeGen.TextBoxManager.getCoverRegions());

    setTimeout(function () {
      // Restore the editing view: pristine image with active covers re-applied.
      MemeGen.TextBoxManager.renderCanvas();
    }, 100);
  });

  detectTextBtn.addEventListener('click', function () {
    // OCR runs for several seconds; disable the button so repeat clicks can't
    // spawn concurrent Tesseract jobs that freeze the tab and duplicate boxes.
    var originalText = detectTextBtn.textContent;
    detectTextBtn.disabled = true;
    detectTextBtn.textContent = 'Detecting…';

    function restore() {
      detectTextBtn.disabled = false;
      detectTextBtn.textContent = originalText;
    }

    var src = MemeGen.ImageLoader.getCanvas();
    MemeGen.TextRecognizer.detectText(src).then(function (regions) {
      var filtered = regions.filter(function (r) { return r.confidence > MIN_OCR_CONFIDENCE; });
      MemeGen.TextBoxManager.loadDetectedBoxes(filtered);
      restore();
    }).catch(function (err) {
      console.error('OCR failed:', err);
      restore();
    });
  });
  // Wire up meme search: when a result is clicked, load it onto the canvas
  // through the same pipeline as a normal upload.
  var searchInput = document.getElementById('meme-search-input');
  var searchResults = document.getElementById('meme-search-results');
  var searchStatus = document.getElementById('meme-search-status');

  if (searchInput && searchResults && MemeGen.MemeSearch) {
    MemeGen.MemeSearch.init({
      input: searchInput,
      results: searchResults,
      status: searchStatus,
      onSelect: function (meme) {
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
});

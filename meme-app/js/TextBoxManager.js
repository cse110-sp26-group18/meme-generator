var MemeGen = window.MemeGen || {};

MemeGen.TextBoxManager = (function () {
  var textBoxes = [];
  // Rectangles (in canvas-pixel space) where OCR-detected text has been hidden
  // behind a background-matched inpaint blend. Re-applied on every render and at
  // export so the original text stays covered beneath the editable boxes.
  var coverRegions = [];
  // Dashed marker elements drawn over OCR-detected text regions before the user
  // clicks them. Clicking a marker removes it and converts that region into an
  // editable text box (createBoxFromRegion). Cleared on each new image load.
  var regionMarkers = [];
  var container = null;
  var canvas = null;
  var imageLoaded = false;

  /**
   * @param {HTMLElement} containerEl - the canvas container that receives
   *   click and touch events for creating text boxes
   * @param {HTMLCanvasElement} canvasEl - used to calculate click coordinates
   *   relative to the canvas origin
   */
  function init(containerEl, canvasEl) {
    container = containerEl;
    canvas = canvasEl;

    container.addEventListener('mousedown', function (e) {
      if (e.target === canvas && imageLoaded) {
        if (getSelectedTextBox()) {
          deselectOrDeleteSelectedTextBox();
          return;
        }
        // getBoundingClientRect() returns viewport-relative coordinates;
        // subtracting rect.left/top converts them to canvas-local coordinates.
        var rect = canvas.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;

        createTextBox(x, y);
      }
    });

    // Support tap-to-create on touch devices
    container.addEventListener('touchend', function (e) {
      if (e.target === canvas && imageLoaded) {
        // preventDefault stops the browser from synthesizing a mouse click
        // after the touch, which would otherwise trigger a second createTextBox.
        e.preventDefault();
        var rect = canvas.getBoundingClientRect();
        // changedTouches contains only the touches that changed in this event;
        // [0] is the first (and typically only) finger involved in the tap.
        var touch = e.changedTouches[0];

        var x = touch.clientX - rect.left;
        var y = touch.clientY - rect.top;

        createTextBox(x, y);
      }
    });

    // mousedown on document (not container) deselects when clicking outside.
    document.addEventListener('mousedown', function (e) {
      if (!container.contains(e.target)) {
        deselectAll();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') {
        return;
      }

      var activeEl = document.activeElement;

      // isContentEditable catches rich-text editor elements alongside
      // INPUT/TEXTAREA/SELECT — prevents accidental deletion while typing.
      if (
        activeEl &&
        (
          activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.isContentEditable
        )
      ) {
        return;
      }

      deleteSelectedTextBox();
    });
  }

  /**
   * @param {boolean} loaded - true once an image is on the canvas, enabling
   *   text box creation on canvas clicks
   */
  function setImageLoaded(loaded) {
    imageLoaded = loaded;
    // A freshly loaded image has no detected text yet — drop covers and markers
    // left over from a previous image so they don't bleed onto the new one.
    if (loaded) {
      coverRegions = [];
      clearDetectedRegions();
    }
  }

  /**
   * Redraws the base image and re-applies every active cover region on top.
   *   This is the editor-side equivalent of the export composite: the visible
   *   canvas always shows OCR-detected text hidden behind its inpaint blend.
   *   Falls back to a plain image redraw when no covers or Inpaint are present.
   */
  function renderCanvas() {
    MemeGen.ImageLoader.redraw();
    if (!canvas || !MemeGen.Inpaint) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    coverRegions.forEach(function (r) {
      MemeGen.Inpaint.coverRegion(ctx, r);
    });
  }

  /**
   * Returns true if an OCR region has enough real content to be worth showing.
   *   Require 3+ alphanumerics for plain text (filters stray single-letter OCR
   *   noise), but keep short numeric labels like "2%", "55", or "0.1%" — any
   *   region containing a digit.
   * @param {{text:string}} region - a detected region
   * @returns {boolean}
   */
  function isMeaningfulRegion(region) {
    var text = region.text || '';
    var alnum = (text.match(/[a-zA-Z0-9]/g) || []).length;
    var hasDigit = /[0-9]/.test(text);
    return alnum >= 3 || hasDigit;
  }

  /**
   * Converts a single OCR region into an editable text box: hides the original
   *   pixels behind an inpaint cover (the "mutation") and adds a text box
   *   pre-filled with the recognized text. Deleting the box restores the pixels.
   *   Called when the user clicks a detected-region marker.
   * @param {{text:string,x:number,y:number,width:number,height:number}} region
   *   - a detected region in canvas-pixel space (see TextRecognizer)
   * @returns {MemeGen.TextBox} the created text box
   */
  function createBoxFromRegion(region) {
    // canvas.width tracks the displayed size in this app, so the source→display
    // scale is ~1, but compute it explicitly so the boxes still line up if that
    // ever changes.
    var scaleX = canvas.offsetWidth  / canvas.width;
    var scaleY = canvas.offsetHeight / canvas.height;

    var cover = {
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height
    };
    coverRegions.push(cover);

    var tb = new MemeGen.TextBox(
      region.x * scaleX,
      region.y * scaleY,
      container
    );

    // Detected boxes hug the recognized text. Clear the default min-width/
    // height (meant to keep manually-created boxes grabbable) so short labels
    // like "2%" don't balloon past the actual text.
    tb.el.style.minWidth  = '0px';
    tb.el.style.minHeight = '0px';
    tb.el.style.width  = Math.round(region.width  * scaleX) + 'px';
    tb.el.style.height = Math.round(region.height * scaleY) + 'px';
    tb.textarea.value  = region.text;
    tb.applyFontSize(Math.round(region.height * scaleY * 0.4));

    tb.onDelete = (function (c) {
      return function (box) {
        // Drop the cover so the original pixels are restored on re-render.
        var ci = coverRegions.indexOf(c);
        if (ci !== -1) coverRegions.splice(ci, 1);
        var idx = textBoxes.indexOf(box);
        if (idx !== -1) textBoxes.splice(idx, 1);
        renderCanvas();
      };
    }(cover));

    tb.onSelect = function (box) {
      deselectAll();
      box.select();
    };

    MemeGen.DragResize.attach(tb);
    textBoxes.push(tb);

    renderCanvas();
    return tb;
  }

  /**
   * Marks OCR-detected text regions with clickable dashed outlines without
   *   touching the image. The original text stays visible; only when the user
   *   clicks a marker does it convert into an editable text box with the
   *   original text covered (createBoxFromRegion). Noise regions are skipped.
   * @param {Array<{text:string,x:number,y:number,width:number,height:number}>}
   *   regions - detected regions in canvas-pixel space (see TextRecognizer)
   */
  function showDetectedRegions(regions) {
    if (!container || !canvas) return;
    // A new scan supersedes any markers still on screen from a prior scan.
    clearDetectedRegions();

    var scaleX = canvas.offsetWidth  / canvas.width;
    var scaleY = canvas.offsetHeight / canvas.height;

    regions.forEach(function (region) {
      if (!isMeaningfulRegion(region)) return;

      var marker = document.createElement('div');
      marker.className = 'ocr-region-marker';
      marker.title = 'Click to edit this text';
      marker.style.left   = Math.round(region.x * scaleX) + 'px';
      marker.style.top    = Math.round(region.y * scaleY) + 'px';
      marker.style.width  = Math.round(region.width  * scaleX) + 'px';
      marker.style.height = Math.round(region.height * scaleY) + 'px';

      marker.addEventListener('click', function (e) {
        e.stopPropagation();
        // Remove this marker, then turn the region into an editable text box.
        var mi = regionMarkers.indexOf(marker);
        if (mi !== -1) regionMarkers.splice(mi, 1);
        marker.remove();

        var tb = createBoxFromRegion(region);
        deselectAll();
        if (tb) tb.select();
      });

      container.appendChild(marker);
      regionMarkers.push(marker);
    });
  }

  /**
   * Removes every detected-region marker from the DOM. Called on new image
   *   loads and reset so markers never bleed across images.
   */
  function clearDetectedRegions() {
    regionMarkers.forEach(function (marker) {
      marker.remove();
    });
    regionMarkers = [];
  }

  /**
   * @returns {Array} the active inpaint cover regions, read by the Exporter so
   *   downloaded/shared memes hide the OCR-detected text the same as the editor.
   */
  function getCoverRegions() {
    return coverRegions;
  }

  /**
   * Creates a new text box at the given position, wires up its callbacks,
   *   attaches drag/resize, and immediately selects and focuses it.
   * @param {number} x - x position in px relative to the canvas origin
   * @param {number} y - y position in px relative to the canvas origin
   */
  function createTextBox(x, y) {
    var tb = new MemeGen.TextBox(0, 0, container);

    tb.onDelete = function (box) {
      var idx = textBoxes.indexOf(box);
      if (idx !== -1) textBoxes.splice(idx, 1);
    };

    tb.onSelect = function (box) {
      deselectAll();
      box.select();
    };

    MemeGen.DragResize.attach(tb);

    textBoxes.push(tb);
    deselectAll();

    // Keep new textbox fully inside the image/template.
    var clampedX = Math.max(0, Math.min(x, container.offsetWidth - tb.el.offsetWidth));
    var clampedY = Math.max(0, Math.min(y, container.offsetHeight - tb.el.offsetHeight));

    tb.el.style.left = clampedX + 'px';
    tb.el.style.top = clampedY + 'px';

    tb.select();
    tb.focusTextarea();
  }

  /**
   * Destroys the currently selected text box, if any.
   */
  function deleteSelectedTextBox() {
    var selectedBox = textBoxes.find(function (tb) {
      return tb.selected;
    });

    if (selectedBox) {
      selectedBox.destroy();
    }
  }

  /**
   * Deselects all active text boxes.
   */
  function deselectAll() {
    textBoxes.forEach(function (tb) {
      tb.deselect();
    });
  }

  /**
   * @returns {MemeGen.TextBox[]} all text boxes currently present on the canvas
   */
  function getAll() {
    return textBoxes;
  }

  // Public wrapper so the Scan Text button (and any future callers) can
  // create a text box without simulating a canvas touch event. Honors the
  // same imageLoaded gate as the tap-on-canvas path.
  function createTextBoxAt(x, y) {
    if (!imageLoaded) return null;
    createTextBox(x, y);
    return textBoxes[textBoxes.length - 1] || null;
  }

  function getSelectedTextBox() {
    return textBoxes.find(function (tb) {
      return tb.selected;
    });
  }

  function isTextBoxEmpty(tb) {
    return !tb.textarea.value.trim();
  }

  function reset() {
    textBoxes.slice().forEach(function (tb) {
      tb.destroy();
    });
    textBoxes = [];
    coverRegions = [];
    clearDetectedRegions();
    imageLoaded = false;
  }

  function deselectOrDeleteSelectedTextBox() {
    var selectedBox = getSelectedTextBox();

    if (!selectedBox) {
      return;
    }

    // Empty textbox should disappear when user clicks out.
    if (isTextBoxEmpty(selectedBox)) {
      selectedBox.destroy();
      return;
    }

    selectedBox.deselect();
  }

  return {
    init: init,
    setImageLoaded: setImageLoaded,
    getAll: getAll,
    createTextBoxAt: createTextBoxAt,
    createBoxFromRegion: createBoxFromRegion,
    showDetectedRegions: showDetectedRegions,
    clearDetectedRegions: clearDetectedRegions,
    renderCanvas: renderCanvas,
    getCoverRegions: getCoverRegions,
    reset: reset
  };
})();

window.MemeGen = MemeGen;

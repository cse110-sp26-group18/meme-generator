var MemeGen = window.MemeGen || {};

MemeGen.TextBoxManager = (function () {
  var textBoxes = [];
  var container = null;
  var canvas = null;
  var imageLoaded = false;
  var isSyncing = false;
  // When an empty text box is destroyed by a click outside the container,
  // suppress the very next canvas create so the same gesture doesn't
  // immediately open a new box.
  var suppressNextCanvasCreate = false;
  // Global font applied to every text box. Changed via the font-settings menu
  // (setFontForAll); newly created boxes adopt it so the choice sticks for
  // future text too. Defaults to the same 'Impact' each TextBox starts with.
  var defaultFontFamily = 'Impact';
  // Detected-text (OCR) covers. Each entry is { x, y, width, height } in
  // canvas-pixel coordinates. Stored as plain data and re-applied via a blended
  // inpaint on every render, so the source image is never mutated — removing a
  // cover restores the original pixels exactly.
  var coverRegions = [];

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
        // Consume the one-click suppression set when an empty box was just
        // destroyed by a click outside the container — that gesture must not
        // immediately open a new box.
        if (consumeSuppressNextCanvasCreate()) return;
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
        if (consumeSuppressNextCanvasCreate()) return;
        // Check for a selected text box first — same behaviour as mousedown.
        if (getSelectedTextBox()) {
          deselectOrDeleteSelectedTextBox();
          return;
        }
        var rect = canvas.getBoundingClientRect();
        // changedTouches contains only the touches that changed in this event;
        // [0] is the first (and typically only) finger involved in the tap.
        var touch = e.changedTouches[0];

        var x = touch.clientX - rect.left;
        var y = touch.clientY - rect.top;

        createTextBox(x, y);
      }
    });

    // mousedown on document (not container): if a selected empty text box
    // exists, destroy it and set the suppression flag so the next canvas
    // click does not immediately recreate a box. For non-empty boxes, simply
    // deselect as before.
    document.addEventListener('mousedown', function (e) {
      if (!container.contains(e.target)) {
        var selected = getSelectedTextBox();
        if (selected && isTextBoxEmpty(selected)) {
          selected.destroy();
          suppressNextCanvasCreate = true;
        } else {
          deselectAll();
        }
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

    // Adopt the current global font so newly added text matches the last
    // choice made in the font-settings menu.
    tb.setFontFamily(defaultFontFamily);

    textBoxes.push(tb);
    deselectAll();

    // Keep new textbox fully inside the image/template.
    var clampedX = Math.max(0, Math.min(x, container.offsetWidth - tb.el.offsetWidth));
    var clampedY = Math.max(0, Math.min(y, container.offsetHeight - tb.el.offsetHeight));

    tb.el.style.left = clampedX + 'px';
    tb.el.style.top = clampedY + 'px';

    if (typeof tb.captureRelativeState === 'function') {
      tb.captureRelativeState();
    }

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

  /**
   * Re-renders the canvas non-destructively: redraw the pristine image, then
   * re-apply every active cover via a blended inpaint. Called after detect,
   * erase/delete of a detected box, and when restoring the editing view after
   * an export. With no covers it is identical to ImageLoader.redraw().
   */
  function renderCanvas() {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    MemeGen.ImageLoader.redraw();
    coverRegions.forEach(function (r) {
      MemeGen.Inpaint.coverRegion(ctx, r);
    });
  }

  /**
   * Turns OCR regions into editable text boxes. Each region becomes a TextBox
   * pre-filled with the recognized text and sized to the detected bounds, with
   * the original baked-in text hidden behind a cover. Low-content noise is
   * skipped. Coordinates arrive in source (canvas) pixels and are scaled to the
   * display for box placement.
   * @param {Array<{text:string,x:number,y:number,width:number,height:number,confidence:number}>} regions
   */
  function loadDetectedBoxes(regions) {
    if (!canvas || !container || !Array.isArray(regions)) return;
    var scaleX = canvas.offsetWidth  / canvas.width;
    var scaleY = canvas.offsetHeight / canvas.height;

    regions.forEach(function (region) {
      // Require 3+ alphanumerics for plain text (drops stray single-letter OCR
      // noise), but keep short numeric labels like "2%", "55", or "0.1%" — any
      // region containing a digit.
      var text = region.text || '';
      var alnum = (text.match(/[a-zA-Z0-9]/g) || []).length;
      var hasDigit = /[0-9]/.test(text);
      if (alnum < 3 && !hasDigit) return;

      // Record the cover as data and re-render — the detected text is hidden by
      // a background-matched blend, not a destructive solid fill.
      var cover = {
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height
      };
      coverRegions.push(cover);

      var tb = new MemeGen.TextBox(region.x * scaleX, region.y * scaleY, container);
      tb.associatedCover = cover;

      // Detected boxes hug the recognized text. Clear the default min-width/height
      // (meant to keep manually-created boxes grabbable) so short labels like
      // "2%" or "55" don't balloon past the actual text.
      tb.el.style.minWidth  = '0px';
      tb.el.style.minHeight = '0px';
      tb.el.style.width  = Math.round(region.width  * scaleX) + 'px';
      tb.el.style.height = Math.round(region.height * scaleY) + 'px';
      tb.textarea.value  = region.text;
      tb.applyFontSize(Math.round(region.height * scaleY * 0.4));
      tb.setFontFamily(defaultFontFamily);

      // Removing the caption keeps its cover, so the cleaned (de-texted)
      // background stays put — deleting a detected box must never bring the
      // original baked-in text back. Covers are cleared only on a fresh image
      // load (see reset()).
      tb.onDelete = function (box) {
        var idx = textBoxes.indexOf(box);
        if (idx !== -1) textBoxes.splice(idx, 1);
        if (box.associatedCover && !box.keepAssociatedCover) {
          var cIdx = coverRegions.indexOf(box.associatedCover);
          if (cIdx !== -1) coverRegions.splice(cIdx, 1);
        }
        renderCanvas();
      };

      tb.onErase = function (box) {
        box.keepAssociatedCover = true;
      };

      tb.onSelect = function (box) {
        deselectAll();
        box.select();
      };

      MemeGen.DragResize.attach(tb);
      if (typeof tb.captureRelativeState === 'function') {
        tb.captureRelativeState();
      }
      textBoxes.push(tb);
    });

    renderCanvas();
    deselectAll();
  }

  /**
   * @returns {Array<{x:number,y:number,width:number,height:number}>} the active
   *   detected-text covers, in canvas-pixel coordinates. Read by the Exporter so
   *   downloaded/shared/copied images match the editing view.
   */
  function getCoverRegions() {
    return coverRegions;
  }

  // Public wrapper so the Scan Text button (and any future callers) can
  // create a text box without simulating a canvas touch event. Honors the
  // same imageLoaded gate as the tap-on-canvas path.
  function createTextBoxAt(x, y) {
    if (!imageLoaded) return null;
    createTextBox(x, y);
    return textBoxes[textBoxes.length - 1] || null;
  }

  /**
   * Sets the global font and applies it to every existing text box. New boxes
   *   created afterwards also adopt it (see createTextBox), so the choice
   *   covers both current and future text.
   * @param {string} value - a font value from MemeGen.TextBox.FONTS
   */
  function setFontForAll(value) {
    defaultFontFamily = value;
    textBoxes.forEach(function (tb) {
      tb.setFontFamily(value);
    });
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
    imageLoaded = false;
    defaultFontFamily = 'Impact';
    coverRegions.length = 0;
  }

  /**
   * Repositions all text boxes proportionally after the container resizes.
   * Called by the ResizeObserver in app.js whenever the canvas-container
   * changes size (e.g. user drags the panel resizer).
   */
  function syncTextBoxesToCanvas() {
    if (isSyncing) return;
    isSyncing = true;
    textBoxes.forEach(function (tb) {
      if (typeof tb.applyRelativeState === 'function') {
        tb.applyRelativeState();
      }
      if (typeof tb.captureRelativeState === 'function') {
        tb.captureRelativeState();
      }
    });
    isSyncing = false;
  }

  /**
   * Creates multiple text boxes in one call, each with an optional preset
   * text string. Used by the AI suggestions flow to pre-populate captions.
   * @param {Array<{x: number, y: number, text?: string}>} items
   */
  function createBatch(items) {
    if (!Array.isArray(items)) return;
    items.forEach(function (item) {
      var tb = createTextBoxAt(item.x, item.y);
      if (!tb) return;
      if (item.text) {
        tb.textarea.value = item.text;
        if (typeof tb.fitToText === 'function') tb.fitToText();
        if (typeof tb.captureRelativeState === 'function') tb.captureRelativeState();
      }
    });
  }

  function consumeSuppressNextCanvasCreate() {
    if (!suppressNextCanvasCreate) return false;
    suppressNextCanvasCreate = false;
    return true;
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
    setFontForAll: setFontForAll,
    reset: reset,
    syncTextBoxesToCanvas: syncTextBoxesToCanvas,
    createBatch: createBatch,
    consumeSuppressNextCanvasCreate: consumeSuppressNextCanvasCreate,
    loadDetectedBoxes: loadDetectedBoxes,
    getCoverRegions: getCoverRegions,
    renderCanvas: renderCanvas
  };
})();

window.MemeGen = MemeGen;

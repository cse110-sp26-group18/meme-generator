var MemeGen = window.MemeGen || {};

MemeGen.TextBoxManager = (function () {
  var textBoxes = [];
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

        // Mirror the mousedown contract (v4 behavior): a tap on the canvas
        // while a text box is selected should deselect it (or delete it if
        // empty) instead of creating a second box. The user has to tap once
        // more — on the now-empty canvas — to actually create a new box.
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
   * Batch-create text boxes from a list of {x, y, text} items.
   * Unlike createTextBox, this does NOT auto-select or focus any box — useful
   * when populating multiple boxes at once (e.g. from an AI suggestion) so the
   * user is not yanked into editing one of them.
   *
   * Returns the array of created TextBox instances.
   */
  function createBatch(items) {
    if (!Array.isArray(items)) return [];

    var created = [];
    items.forEach(function (item) {
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

      // Set text + run fit-to-text BEFORE clamping so the clamp math uses
      // the box's post-fit dimensions, not the default 200×60 placeholder.
      if (typeof item.text === 'string' && item.text.length > 0) {
        tb.textarea.value = item.text;
        tb.textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }

      var x = typeof item.x === 'number' ? item.x : 0;
      var y = typeof item.y === 'number' ? item.y : 0;
      var clampedX = Math.max(0, Math.min(x, container.offsetWidth  - tb.el.offsetWidth));
      var clampedY = Math.max(0, Math.min(y, container.offsetHeight - tb.el.offsetHeight));
      tb.el.style.left = clampedX + 'px';
      tb.el.style.top  = clampedY + 'px';

      created.push(tb);
    });

    // Leave every box deselected so no textarea steals focus.
    deselectAll();
    return created;
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
    createBatch: createBatch,
    reset: reset
  };
})();

window.MemeGen = MemeGen;

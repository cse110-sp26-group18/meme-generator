var MemeGen = window.MemeGen || {};

MemeGen.TextBoxManager = (function () {
  var textBoxes = [];
  var container = null;
  var canvas = null;
  var imageLoaded = false;

  function init(containerEl, canvasEl) {
    container = containerEl;
    canvas = canvasEl;

    container.addEventListener('mousedown', function (e) {
      if (e.target === canvas && imageLoaded) {
        var rect = canvas.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        createTextBox(x, y);
      } else if (e.target === canvas) {
        deselectAll();
      }
    });

    // Support tap-to-create on touch devices
    container.addEventListener('touchend', function (e) {
      if (e.target === canvas && imageLoaded) {
        e.preventDefault();
        var rect = canvas.getBoundingClientRect();
        var touch = e.changedTouches[0];
        var x = touch.clientX - rect.left;
        var y = touch.clientY - rect.top;
        createTextBox(x, y);
      }
    });

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

  function setImageLoaded(loaded) {
    imageLoaded = loaded;
  }

  function createTextBox(x, y) {
    var tb = new MemeGen.TextBox(x, y, container);

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

  function deleteSelectedTextBox() {
    var selectedBox = textBoxes.find(function (tb) {
      return tb.selected;
    });

    if (selectedBox) {
      selectedBox.destroy();
    }
  }

  function deselectAll() {
    textBoxes.forEach(function (tb) {
      tb.deselect();
    });
  }

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

  return {
    init: init,
    setImageLoaded: setImageLoaded,
    getAll: getAll,
    createTextBoxAt: createTextBoxAt,
    createBatch: createBatch
  };
})();

window.MemeGen = MemeGen;
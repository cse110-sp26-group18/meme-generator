var MemeGen = window.MemeGen || {};

MemeGen.TextBoxManager = (function () {
  var textBoxes = [];
  var container = null;
  var canvas = null;
  var imageLoaded = false;
  // Detected-text covers, stored as data so the original image is never mutated.
  // Each entry is { x, y, width, height } in canvas pixel coordinates.
  var coverRegions = [];

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

// Re-render the canvas non-destructively: redraw the pristine image, then
// re-apply every active cover via a blended inpaint. The original image is
// never mutated, so removing a cover restores the source pixels exactly.
function renderCanvas() {
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  MemeGen.ImageLoader.redraw();
  coverRegions.forEach(function (r) {
    MemeGen.Inpaint.coverRegion(ctx, r);
  });
}

function loadDetectedBoxes(regions) {
  var scaleX = canvas.offsetWidth  / canvas.width;
  var scaleY = canvas.offsetHeight / canvas.height;

  regions.forEach(function (region) {
    // Skip regions with no real content. Require 3+ alphanumerics for plain
    // text (filters stray single-letter OCR noise), but keep short numeric
    // labels like "2%", "55", or "0.1%" — any region containing a digit.
    var alnum = (region.text.match(/[a-zA-Z0-9]/g) || []).length;
    var hasDigit = /[0-9]/.test(region.text);
    if (alnum < 3 && !hasDigit) return;

    // Record the cover as data and re-render — the detected text is hidden by a
    // background-matched blend, not a destructive solid fill.
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

    tb.el.style.width  = Math.round(region.width  * scaleX) + 'px';
    tb.el.style.height = Math.round(region.height * scaleY) + 'px';
    tb.textarea.value  = region.text;
    tb.applyFontSize(Math.round(region.height * scaleY * 0.4));

    // Erase destroys the box too, which fires onDelete; this flag tells onDelete
    // to keep the cover (erase the text from the image) rather than restore it.
    var keepCover = false;

    tb.onDelete = (function (c) {
      return function (box) {
        if (!keepCover) {
          // Drop the cover so the original pixels are restored on re-render.
          var ci = coverRegions.indexOf(c);
          if (ci !== -1) coverRegions.splice(ci, 1);
        }
        var idx = textBoxes.indexOf(box);
        if (idx !== -1) textBoxes.splice(idx, 1);
        renderCanvas();
      };
    }(cover));

    tb.onSelect = function (box) {
      deselectAll();
      box.select();
    };

    tb.onErase = (function (c) {
      return function () {
        // Keep the cover in place after the box is destroyed.
        keepCover = true;
        if (coverRegions.indexOf(c) === -1) coverRegions.push(c);
      };
    }(cover));

    MemeGen.DragResize.attach(tb);
    textBoxes.push(tb);
  });

  renderCanvas();
  deselectAll();
}

  function getCoverRegions() {
    return coverRegions;
  }

  return {
    init: init,
    setImageLoaded: setImageLoaded,
    getAll: getAll,
    loadDetectedBoxes: loadDetectedBoxes,
    getCoverRegions: getCoverRegions,
    renderCanvas: renderCanvas
  };
})();

window.MemeGen = MemeGen;
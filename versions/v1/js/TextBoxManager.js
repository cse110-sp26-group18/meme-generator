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

  return {
    init: init,
    setImageLoaded: setImageLoaded,
    getAll: getAll
  };
})();

window.MemeGen = MemeGen;